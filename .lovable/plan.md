

# Consent Management System — Frontend Skeleton

A corporate-style dashboard app for managing photography/media projects and tracking participant consent (images + consent PDFs). Built as a frontend skeleton with sample data, ready for future database and ML pipeline integration.

---

## 1. Authentication Screen
- Clean login page with username/password fields
- Role selector (Admin / User) 
- Hardcoded sample credentials (admin/admin, user/user)
- Stores role in app state to control routing and visibility

## 2. Layout & Navigation
- Persistent left sidebar with role-based menu items
- Sidebar shows: Dashboard, Create Project (admin only), user profile/role indicator
- Top bar with page title and logout button
- Responsive: sidebar collapses to hamburger menu on mobile

## 3. Admin — Dashboard
- Grid/table view of all projects with key info (name, status, participant count, date)
- Search/filter bar
- Quick action buttons (view, edit, delete) per project
- 1 sample project pre-populated

## 4. Admin — Create/Edit Project
- Form with fields: project name, description, status
- Sections for uploading images and consent PDFs (UI only, with separate upload buttons for each)
- Save/cancel actions with toast feedback

## 5. Admin — Project Details Page
- Project info header (name, description, status, dates)
- Tabs or sections for:
  - **Uploaded Images** — grid preview with thumbnail cards
  - **Consent PDFs** — list with preview capability
  - **Model Results** — table showing matching vs non-matching images/PDFs (placeholder data)
  - **Generate Excel** button (shows toast "Will connect to ML pipeline later")
- Edit/Delete project actions

## 6. User — Dashboard
- Shows only projects the user is enrolled in (current and past)
- Cards with project name, enrollment status, date

## 7. User — Project Details
- Read-only view of project info
- Preview of their own uploaded images and PDFs
- Shows which project each upload belongs to

## 8. Shared Features
- Subtle fade/slide animations on page transitions and card interactions
- Clean corporate color palette (neutral grays, blue accents)
- Responsive design across all screens
- Image lightbox preview and PDF preview modal
- Toast notifications for actions
- Sample data: 1 project with a few placeholder images and PDFs

