import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { initializeIcons } from '@fluentui/react'
import { PublicClientApplication } from '@azure/msal-browser'

import './index.css'

import Layout from './pages/layout/Layout'
import NoPage from './pages/NoPage'
import Chat from './pages/chat/Chat'
import { AppStateProvider } from './state/AppProvider'

// MSAL configuration
const msalConfig = {
  auth: {
    clientId: '30119f0e-fbbd-4272-aad1-f18b52297168', // Your App Registration Client ID
    authority: 'https://login.microsoftonline.com/a141d6e8-fddb-4309-8b71-44753a78495a',
    redirectUri: window.location.origin
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false
  }
}

const msalInstance = new PublicClientApplication(msalConfig)

// Initialize MSAL
msalInstance.initialize().then(() => {
  console.log('MSAL initialized')
})

// Teams context detection
function isTeamsContext(): boolean {
  return !!(
    window.parent !== window.self ||
    window.name === 'embedded-page-container' ||
    window.location.search.includes('teams') ||
    document.referrer.includes('teams.microsoft.com') ||
    navigator.userAgent.includes('Teams/')
  )
}

// Authentication function using MSAL popup
async function authenticateWithMSAL(): Promise<string | null> {
  try {
    // Check if user is already signed in
    const accounts = msalInstance.getAllAccounts()
    if (accounts.length > 0) {
      // Try silent authentication first
      try {
        const silentRequest = {
          scopes: ['User.Read'],
          account: accounts[0]
        }
        const response = await msalInstance.acquireTokenSilent(silentRequest)
        return response.accessToken
      } catch (silentError) {
        console.log('Silent authentication failed, falling back to popup')
      }
    }

    // Use popup authentication - works across all platforms including macOS Teams
    const loginRequest = {
      scopes: ['User.Read'],
      prompt: 'select_account'
    }
    
    const response = await msalInstance.loginPopup(loginRequest)
    console.log('MSAL popup authentication successful')
    return response.accessToken
  } catch (error) {
    console.error('MSAL authentication failed:', error)
    return null
  }
}

// Setup authentication for API requests
function setupAuthHeaders(token: string) {
  // Add authorization header to all API requests
  const originalFetch = window.fetch
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    headers.set('Authorization', `Bearer ${token}`)
    
    return originalFetch(input, {
      ...init,
      headers
    })
  }
}

// Initialize authentication
async function initializeAuth() {
  if (isTeamsContext()) {
    console.log('Teams context detected, initializing MSAL popup authentication')
    const token = await authenticateWithMSAL()
    if (token) {
      setupAuthHeaders(token)
      console.log('Authentication successful')
    } else {
      console.warn('Authentication failed')
    }
  } else {
    console.log('Browser context, no Teams authentication needed')
  }
}

// Initialize icons for Fluent UI
initializeIcons()

// Initialize authentication
initializeAuth()

export default function App() {
  return (
    <AppStateProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Chat />} />
            <Route path="*" element={<NoPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppStateProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
