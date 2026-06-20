import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import LogRocket from 'logrocket'
import App from './App.jsx'
import './index.css'

LogRocket.init('wzlqix/seeds-01')

// Identify session with the demoUserId once it's in localStorage
const userId = localStorage.getItem('demoUserId')
if (userId) {
  LogRocket.identify(userId, { app: 'SmartDukan' })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
