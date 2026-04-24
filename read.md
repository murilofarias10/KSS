KSS - Kubik Smart Symbols  
A smart way to turn your engineering PDFs into interactive, searchable electrical dashboards.

KSS is a full-stack web application for managing, visualizing, and extracting electrical components from engineering drawings. The project combines OCR-based extraction, interactive dashboards, and persistent storage for collaborative electrical design review.

Features
- OCR Extraction: Automatically extract component IDs and names from engineering drawing images using Tesseract OCR (extract_components.py).
- Interactive Dashboard: Visualize, annotate, and manage components on drawing images (electrical-dashboard/src/Dashboard.js).
- Project Gallery: Organize multiple projects, edit titles, and delete projects (electrical-dashboard/src/GalleryPage.js).
- Backend API: Node.js/Express backend for persistent storage and file management (backend/server.js).
- JSON Storage: Store component data in per-image JSON files for portability and versioning.
- Excel Export/Import: Download and upload component lists in Excel format for reporting and bulk editing.
- Collaboration: Assign responsible persons, track status, and modify project metadata.

Tech Stack
- Frontend: React.js, JavaScript, CSS
- Backend: Node.js, Express.js
- OCR: Python, Tesseract, Pillow
- Storage: Local JSON files
- Other: XLSX export/import, RESTful API

Getting Started
1. Clone the repository.
2. Install dependencies:
   - Frontend: cd electrical-dashboard && npm install
   - Backend: cd backend && npm install
   - OCR tools: ensure Python, pip, and Tesseract OCR are installed; install Python requirements (e.g., pip install -r requirements.txt).
3. Run the backend:
   - cd backend && npm start
4. Run the frontend:
   - cd electrical-dashboard && npm start
5. Use the dashboard to upload drawings and extract components.

Contributing
- Report issues and submit pull requests.
- Describe changes clearly and include test steps for major updates.

License
- Include project license information here.

