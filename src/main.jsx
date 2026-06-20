import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import LogRocket from 'logrocket'
import { getDemoUserId } from './demoUser'
import App from './App.jsx'
import './index.css'

LogRocket.init('wzlqix/seeds-01')

// Guarantee every visitor has a unique userId before React mounts
const userId = getDemoUserId()
LogRocket.identify(userId, { app: 'SmartDukan' })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
