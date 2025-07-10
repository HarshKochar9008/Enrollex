# Enrollex

Enrollex is a modern web application designed to streamline college administration. It enables colleges to manage student registrations, departments, documents, and ID cards—all in one secure platform. The system is optimized for performance and cost, loading pages only when needed.

## Key Features
- **Smart Registration:** Register students, staff, and admins with photo capture and department selection.
- **ID & Document Generator:** Generate ID cards, bonafide slips, and documents with QR codes in one click.
- **Department Control:** Each department can manage its own documents, circulars, and student records.
- **Admin & Super Admin Panels:** Dedicated interfaces for different administrative roles.
- **Attendance & Queue Management:** Tools for managing student attendance and queues.
- **Dark Mode Support:** Modern, accessible UI with light/dark mode toggle.

## System Workflow
1. **Student Registration:** Student fills the registration form and receives a Student ID.
2. **Photo Capture:** Student visits the photo room; admin takes a photo and generates an Application Number.
3. **Document Verification:** Department admin verifies submitted documents.
4. **Completion:** Once all documents are verified, registration is complete.

## Tech Stack
- React (with React Router)
- Tailwind CSS
- Lucide React Icons
- Other supporting libraries (see `package.json`)

## Getting Started
1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Run the app in development mode:**
   ```bash
   npm start
   ```
   Open [http://localhost:3000](http://localhost:3000) to view it in your browser.
3. **Build for production:**
   ```bash
   npm run build
   ```
4. **Run tests:**
   ```bash
   npm test
   ```

## Project Structure
- `src/` – Main source code (components, pages, admin modules)
- `public/` – Static assets and HTML template
- `tailwind.config.js` – Tailwind CSS configuration

## Contact
For support, email: [support@enrollex.com](mailto:support@enrollex.com)
