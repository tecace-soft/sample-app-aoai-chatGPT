import logging
from quart import request

def get_authenticated_user_details(request_headers):
    """
    Retrieve the authenticated user's details from the request headers.
    For MSAL popup authentication, return a simple user structure.
    """
    try:
        # For now, return a simplified user structure for all authenticated requests
        # TODO: Implement proper MSAL token validation if needed server-side
        return {
            'user_principal_id': 'msal-authenticated-user',
            'user_name': 'Authenticated User',
            'auth_provider': 'msal'
        }
        
    except Exception as e:
        logging.error(f"Error getting authenticated user details: {e}")
        # Return default user for development
        return {
            'user_principal_id': 'sample-user-id', 
            'user_name': 'Sample User',
            'auth_provider': 'development'
        }