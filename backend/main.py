import os
import json
import difflib
from pydantic import BaseModel
from typing import List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from supabase import create_client, Client

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") # Ensure this is your SERVICE_ROLE key in Railway to bypass RLS
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")

groq_client = Groq(api_key=GROQ_API_KEY)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

@app.get("/")
def home():
    return {"status": "Voice Inventory API is online"}

@app.post("/voice-search/")
async def voice_search(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    preview_only: bool = Form(False),
    web_speech_text: str = Form(""),
    session_id: str = Form(""),
):
    temp_filename = None
    try:
        temp_filename = f"temp_{file.filename}"
        with open(temp_filename, "wb") as buffer:
            buffer.write(await file.read())

        # 1. Transcribe
        inventory_vocabulary = "Aashirvaad Atta, Chana Dal, Fortune Sunflower Oil, Amul Ghee, Tata Salt, Garam Masala, Basmati Rice, Chawal, Toor Dal, Moong Dal, Wheat Gehu, Poha, Maida, Urad Dal, Kabuli Chana"
        
        with open(temp_filename, "rb") as audio_file:
            transcript = groq_client.audio.transcriptions.create(
                model="whisper-large-v3-turbo", 
                file=(temp_filename, audio_file.read()),
                language="en",
                prompt=inventory_vocabulary 
            )
        
        spoken_text = transcript.text.strip().rstrip(".!? ")
        
        if temp_filename and os.path.exists(temp_filename):
            os.remove(temp_filename)

        if not spoken_text:
            return {"spoken_text": "", "parsed_items": [], "results": [], "message": "No voice detected"}

        # 2. Extract Items and Quantities using LLM
        parser_prompt = f"""
        You are an expert inventory data clean-up engine. Your job is to extract items and their quantities from the spoken text.
        - Fix any obvious spelling typos.
        - If a quantity is not explicitly stated, assume it is 1.
        - Return ONLY a JSON object containing an array called "items". Each item should have "name" (string) and "quantity" (number).
        
        Example Output:
        {{
          "items": [
            {{"name": "Basmati Rice", "quantity": 2}},
            {{"name": "Oil", "quantity": 1}}
          ]
        }}

        Text: {spoken_text}
        """

        chat_completion = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": parser_prompt}],
            response_format={"type": "json_object"}
        )

        raw_content = chat_completion.choices[0].message.content.strip()
        parsed_response = json.loads(raw_content)
        items_to_bill = parsed_response.get("items", [])

        if not items_to_bill:
            return {"spoken_text": spoken_text, "parsed_items": [], "results": [], "message": "Could not extract items."}

        billed_results = []
        total_bill_amount = 0.0

        # Helper function for robust phonetic and fuzzy matching — returns (score, tier)
        def calculate_match_score(search_term, db_name, aliases):
            def normalize_phonetics(text):
                text = text.lower().strip()
                swaps = [
                    ("ch", "c"), ("sh", "s"), ("ph", "f"), ("v", "w"),
                    ("z", "j"), ("ee", "i"), ("oo", "u"), ("aa", "a"),
                    ("gh", "g"), ("dh", "d"), ("bh", "b"), ("kh", "k"), ("th", "t")
                ]
                for old, new in swaps:
                    text = text.replace(old, new)
                if not text: return text
                reduced = text[0]
                for char in text[1:]:
                    if char != reduced[-1]:
                        reduced += char
                return reduced

            search_raw = search_term.lower().strip()
            db_raw = db_name.lower().strip()

            # --- TIER 1: Exact or Substring ---
            if search_raw == db_raw: return 1.0, "exact"
            if search_raw in db_raw or db_raw in search_raw: return 0.95, "exact"
            for alias in aliases:
                alias_raw = alias.lower().strip()
                if search_raw == alias_raw: return 1.0, "exact"
                if search_raw in alias_raw or alias_raw in search_raw: return 0.95, "exact"

            # --- TIER 2: Phonetic Normalization ---
            search_norm = normalize_phonetics(search_raw)
            db_norm = normalize_phonetics(db_raw)
            alias_norms = [normalize_phonetics(a) for a in aliases]

            if search_norm == db_norm: return 0.9, "phonetic"
            if search_norm in db_norm or db_norm in search_norm: return 0.85, "phonetic"
            for a_norm in alias_norms:
                if search_norm == a_norm: return 0.9, "phonetic"
                if search_norm in a_norm or a_norm in search_norm: return 0.85, "phonetic"

            # --- TIER 3: Token Overlap ---
            search_tokens = set(search_norm.split())
            db_tokens = set(db_norm.split())
            for a_norm in alias_norms:
                db_tokens.update(a_norm.split())
            overlap = search_tokens.intersection(db_tokens)
            token_score = 0
            if search_tokens and db_tokens:
                token_score = len(overlap) / max(len(search_tokens), len(db_tokens))

            # --- TIER 4: Character-Level Fuzzy (difflib) ---
            fuzzy_raw = difflib.SequenceMatcher(None, search_raw, db_raw).ratio()
            fuzzy_norm = difflib.SequenceMatcher(None, search_norm, db_norm).ratio()
            fuzzy_score = max(fuzzy_raw, fuzzy_norm)
            for a, a_norm in zip(aliases, alias_norms):
                a_raw = a.lower().strip()
                f_raw = difflib.SequenceMatcher(None, search_raw, a_raw).ratio()
                f_norm = difflib.SequenceMatcher(None, search_norm, a_norm).ratio()
                fuzzy_score = max(fuzzy_score, f_raw, f_norm)

            if token_score >= fuzzy_score:
                return token_score, "token"
            return fuzzy_score, "fuzzy"

        # 3. Process each item: Match against DB and Deduct Stock
        for item in items_to_bill:
            name = item.get("name", "")
            qty_to_deduct = float(item.get("quantity", 1.0))

            stock_response = supabase.table("user_stock") \
                .select("*, master_inventory(*)") \
                .eq("user_id", user_id) \
                .execute()
            user_stock_list = stock_response.data

            best_match = None
            best_score = 0.0
            best_tier = "none"

            for stock_item in user_stock_list:
                master_inv = stock_item.get("master_inventory", {})
                db_name = master_inv.get("item_name", "")
                aliases = stock_item.get("aliases") or []

                score, tier = calculate_match_score(name, db_name, aliases)

                if score > best_score:
                    best_score = score
                    best_tier = tier
                    best_match = stock_item

            if best_match and best_score >= 0.55:
                current_stock = float(best_match.get("current_stock", 0.0))
                price = float(best_match.get("selling_price", 0.0))

                new_stock = current_stock - qty_to_deduct
                if new_stock < 0: new_stock = 0

                if not preview_only:
                    supabase.table("user_stock") \
                        .update({"current_stock": new_stock}) \
                        .eq("id", best_match["id"]) \
                        .execute()

                item_total = price * qty_to_deduct
                total_bill_amount += item_total

                billed_results.append({
                    "item_name": best_match["master_inventory"]["item_name"],
                    "quantity_billed": qty_to_deduct,
                    "price_per_unit": price,
                    "item_total": item_total,
                    "stock_remaining": new_stock,
                    "stock_id": best_match["id"],
                    "current_stock": current_stock,
                    "match_score": round(best_score, 3),
                    "match_tier": best_tier,
                    "searched_as": name,
                })
            else:
                billed_results.append({
                    "item_name": name,
                    "quantity_billed": qty_to_deduct,
                    "error": "Item not found in your inventory",
                    "match_score": round(best_score, 3),
                    "match_tier": best_tier,
                    "searched_as": name,
                })

        # 4. Log the full session to voice_logs
        try:
            supabase.table("voice_logs").insert({
                "session_id": session_id,
                "user_id": user_id,
                "web_speech_text": web_speech_text,
                "whisper_text": spoken_text,
                "llm_extracted_items": items_to_bill,
                "match_results": billed_results,
                "checkout_completed": False,
            }).execute()
        except Exception as log_err:
            print(f"[voice_logs] insert failed: {log_err}")

        return {
            "spoken_text": spoken_text,
            "parsed_items": items_to_bill,
            "total_bill_amount": total_bill_amount,
            "results": billed_results,
            "session_id": session_id,
        }

    except Exception as e:
        if temp_filename and os.path.exists(temp_filename):
            os.remove(temp_filename)
        raise HTTPException(status_code=500, detail=str(e))

from typing import List, Optional

class CheckoutItem(BaseModel):
    stock_id: Optional[str] = None
    new_stock: Optional[float] = None
    item_name: str
    quantity_billed: float
    price_per_unit: float
    item_total: float
    error: Optional[bool] = False

class CheckoutRequest(BaseModel):
    user_id: str
    total_bill_amount: float
    discount_amount: Optional[float] = 0.0
    customer_name: Optional[str] = None
    is_credit: Optional[bool] = False
    session_id: Optional[str] = None
    items: List[CheckoutItem]

@app.post("/voice-checkout/")
async def voice_checkout(request: CheckoutRequest):
    try:
        # 1. Update stock for items that have a stock_id
        for item in request.items:
            if item.stock_id is not None and item.new_stock is not None:
                supabase.table("user_stock") \
                    .update({"current_stock": item.new_stock}) \
                    .eq("id", item.stock_id) \
                    .execute()

        # 2. Insert record into past_bills
        bill_data = {
            "user_id": request.user_id,
            "total_amount": request.total_bill_amount,
            "discount_amount": request.discount_amount,
            "customer_name": request.customer_name,
            "is_credit": request.is_credit,
            "bill_details": [item.model_dump() for item in request.items]
        }
        
        supabase.table("past_bills").insert(bill_data).execute()

        # 3. Mark the voice_logs session as completed
        if request.session_id:
            try:
                supabase.table("voice_logs") \
                    .update({"checkout_completed": True}) \
                    .eq("session_id", request.session_id) \
                    .execute()
            except Exception as log_err:
                print(f"[voice_logs] update failed: {log_err}")

        return {"status": "success", "message": "Stock updated and bill saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
