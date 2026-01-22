"""
Simple Flask server for NSU Commute Optimizer
Serves HTML and CSV files with proper CORS headers
"""

from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configuration
DATA_DIR = 'data'  # Directory containing CSV files
HTML_FILE = 'index.html'
PORT = 5000

# Ensure data directory exists
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)
    print(f"Created {DATA_DIR} directory - please add your CSV files there")

# Serve main HTML page
@app.route('/')
def index():
    """Serve the main application HTML file"""
    try:
        return send_from_directory('.', HTML_FILE)
    except FileNotFoundError:
        return jsonify({"error": "index.html not found"}), 404

# Serve CSV files from data directory
@app.route('/api/<filename>')
def serve_csv(filename):
    """
    Serve CSV files from the data directory
    Accessible at /api/Locations.csv, /api/Tracks.csv, etc.
    """
    # Security: only allow CSV files
    if not filename.endswith('.csv'):
        return jsonify({"error": "Only CSV files allowed"}), 403
    
    try:
        return send_from_directory(DATA_DIR, filename, mimetype='text/csv')
    except FileNotFoundError:
        return jsonify({"error": f"{filename} not found"}), 404

# Health check endpoint
@app.route('/health')
def health():
    """Health check endpoint for monitoring"""
    return jsonify({
        "status": "healthy",
        "version": "3.0",
        "data_files": os.listdir(DATA_DIR) if os.path.exists(DATA_DIR) else []
    })

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Resource not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

# Development server
if __name__ == '__main__':
    print(f"""
    ╔══════════════════════════════════════════════╗
    ║   NSU Commute Optimizer Server v3.0          ║
    ╠══════════════════════════════════════════════╣
    ║  Server starting...                          ║
    ║  URL: http://localhost:{PORT}                 ║
    ║  API: http://localhost:{PORT}/api/            ║
    ║  Health: http://localhost:{PORT}/health       ║
    ╚══════════════════════════════════════════════╝
    """)
    
    # Check for required files
    if not os.path.exists(HTML_FILE):
        print(f"⚠️  Warning: {HTML_FILE} not found!")
    
    required_csvs = ['Locations.csv', 'Tracks.csv', 'Variance.csv']
    for csv in required_csvs:
        if not os.path.exists(os.path.join(DATA_DIR, csv)):
            print(f"⚠️  Warning: {DATA_DIR}/{csv} not found!")
    
    print("\n✓ Press Ctrl+C to stop the server\n")
    
    # Run server
    app.run(
        host='0.0.0.0',  # Accessible from network
        port=PORT,
        debug=True  # Change to False for production
    )
