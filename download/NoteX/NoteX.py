#!/usr/bin/env python3
"""
NoteX Desktop App
A note-taking application that works offline and syncs when online.
Made by Rdev
"""

import webview
import os
import json
import threading

try:
    import requests
except ImportError:
    requests = None

# Supabase config
SUPABASE_URL = "https://awmkattxglhpmqsfnqsm.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3bWthdHR4Z2xocG1xc2ZucXNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc0MjEwNTYsImV4cCI6MjA1Mjk5NzA1Nn0.wqTzQGI9c6kE7mVLhXqj7A8xdJ8jNJ3NHfI2KFBkKXA"

class NoteXAPI:
    """API for communication between JS and Python"""
    
    def __init__(self):
        self.user = None
        self.offline_notes = []
        self.is_online = True
        
    def check_online(self):
        """Check if the app is online"""
        if requests is None:
            return False
        try:
            requests.get("https://www.google.com", timeout=3)
            self.is_online = True
            return True
        except:
            self.is_online = False
            return False
    
    def login(self, username, password):
        """Login user via Supabase"""
        if not self.check_online():
            return {"error": "You are offline. Please connect to the internet to login."}
        
        try:
            response = requests.post(
                f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Content-Type": "application/json"
                },
                json={"email": f"{username}@notex.local", "password": password}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.user = {
                    "id": data.get("user", {}).get("id", "unknown"),
                    "username": username,
                    "access_token": data.get("access_token", "")
                }
                return {"success": True, "user": self.user}
            else:
                return {"error": "Invalid username or password"}
        except Exception as e:
            return {"error": str(e)}
    
    def signup(self, name, username, password):
        """Signup user via Supabase"""
        if not self.check_online():
            return {"error": "You are offline. Please connect to the internet to signup."}
        
        try:
            response = requests.post(
                f"{SUPABASE_URL}/auth/v1/signup",
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Content-Type": "application/json"
                },
                json={
                    "email": f"{username}@notex.local",
                    "password": password,
                    "data": {"name": name, "username": username}
                }
            )
            
            if response.status_code == 200:
                return {"success": True}
            else:
                error_data = response.json()
                return {"error": error_data.get("msg", "Signup failed")}
        except Exception as e:
            return {"error": str(e)}
    
    def sync_notes(self, notes):
        """Sync offline notes with Supabase"""
        if not self.check_online():
            return {"error": "Offline"}
        
        if not self.user:
            return {"error": "Not logged in"}
        
        synced = []
        for note in notes:
            if note.get("offline") and not note.get("synced"):
                try:
                    response = requests.post(
                        f"{SUPABASE_URL}/rest/v1/notes",
                        headers={
                            "apikey": SUPABASE_ANON_KEY,
                            "Authorization": f"Bearer {self.user['access_token']}",
                            "Content-Type": "application/json",
                            "Prefer": "return=representation"
                        },
                        json={
                            "title": note.get("title", "Untitled"),
                            "content": note.get("content", ""),
                            "author_id": self.user["id"]
                        }
                    )
                    
                    if response.status_code == 201:
                        synced.append(note["id"])
                except Exception:
                    pass
        
        return {"success": True, "synced": synced}
    
    def get_status(self):
        """Get current status"""
        return {
            "online": self.is_online,
            "user": self.user
        }

def main():
    """Main entry point"""
    # Create API instance
    api = NoteXAPI()
    
    # Get HTML path
    script_dir = os.path.dirname(os.path.abspath(__file__))
    html_path = os.path.join(script_dir, 'web', 'index.html')
    
    # Create window
    window = webview.create_window(
        'NoteX - Desktop Notes',
        f'file://{html_path}',
        js_api=api,
        width=1200,
        height=800,
        min_size=(800, 600),
        resizable=True
    )
    
    # Start webview
    webview.start(debug=False)

if __name__ == '__main__':
    main()
