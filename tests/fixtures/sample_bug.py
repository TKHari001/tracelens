# Sample Python file with deliberate bugs and errors for X-RAY VISION analyzer verification

import os
import sys
import subprocess
import sqlite3
import pickle

SECRET_KEY = "sk-proj-1234567890abcdef1234567890abcdef"

def fetch_user_data(user_id):
    # SQL Injection via string formatting
    conn = sqlite3.connect("database.db")
    cursor = conn.cursor()
    cursor.execute(f"SELECT * FROM users WHERE id = '{user_id}'")
    return cursor.fetchone()
    # Dead code after return
    print("Unreachable code after return statement")

def execute_user_command(user_input):
    # Unsafe eval usage
    result = eval(user_input)
    # Shell=True command injection vulnerability
    subprocess.Popen(f"ls -la {user_input}", shell=True)
    return result

def read_config_file(filename):
    # Resource leak: open file without with block or close()
    f = open(filename, "r")
    data = f.read()
    return data

def process_untrusted_pickle(payload):
    # Unsafe pickle deserialization
    obj = pickle.loads(payload)
    return obj

def dangerous_error_handling():
    try:
        x = 10 / 0
    except:
        # Bare except swallowing exceptions silently
        pass

def syntax_error_demo():
    if True:
        print("Missing closing parenthesis")
