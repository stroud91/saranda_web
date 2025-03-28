import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY')
    
    # Clerk configuration for backend verification
    CLERK_SECRET_KEY = os.environ.get('CLERK_SECRET_KEY')
    CLERK_PUBLIC_KEY_URL = os.environ.get('CLERK_PUBLIC_KEY_URL', "https://api.clerk.dev/public-key")
    CLERK_AUDIENCE = os.environ.get('CLERK_AUDIENCE', "your-clerk-audience")
    CLERK_ISSUER = os.environ.get('CLERK_ISSUER', "https://api.clerk.dev")
    
    # Frontend publishable key; if using Vite or Next.js, expose this in the client build
    VITE_CLERK_PUBLISHABLE_KEY = os.environ.get('VITE_CLERK_PUBLISHABLE_KEY')  
    # or if you're using Next.js: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Adjust database URL if needed
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL').replace('postgres://', 'postgresql://')
    SQLALCHEMY_ECHO = True
