import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppProvider } from './lib.jsx'
import App from './App.jsx'
import './style.css'
createRoot(document.getElementById('root')).render(<BrowserRouter><AppProvider><App /></AppProvider></BrowserRouter>)
