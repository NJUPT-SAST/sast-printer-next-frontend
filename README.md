<p align="center">
  <img src="public/logo-feishu.svg" alt="Feishu Logo" width="120" />
</p>
<h1 align="center">SAST Cloud Printer</h1>

A modern web frontend application for the **GoPrint** print service API. It provides an intuitive interface for managing printers, submitting print jobs, handling manual/automatic duplex printing workflows, and viewing print queue statuses.

## Technologies Used

- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite
- **Routing:** React Router DOM
- **Styling:** Tailwind CSS + PostCSS
- **Icons:** Lucide React
- **Network:** Axios

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- npm, yarn, or pnpm

### Installation

Install the project dependencies:

```bash
npm install
```

### Running the Project

To run the application locally, you have two main parts:

**Start the Frontend Application:**  

   In a separate terminal, launch the Vite development server.
   ```bash
   npm run dev
   ```
   Open your browser and navigate to the local URL (typically `http://localhost:5173`).

### Building for Production

To create an optimized production build:

```bash
npm run build
```

To preview the generated production build locally:

```bash
npm run start
```

## Environment Configuration

In development, you may need to configure the backend API address to solve CORS issues. Create or modify the `.env` file in the root directory:

```env
# Change this to your actual backend API URL
VITE_API_URL=http://localhost:5001
```

In production, since the frontend is packaged and served directly by the backend server, it automatically uses the same domain and port, requiring no additional environment variable configuration for the API URL.

## Project Structure

- `src/components/`: Reusable UI elements (Header, Authentication, Language Switcher, etc.)
- `src/pages/`: Main application views (Home, Printers, Jobs)
- `src/lib/`: Utilities, API definitions (`api.ts`), and localization (`i18n.tsx`, `i18n.json`)

## Backend Context

This frontend is built to work seamlessly with the GoPrint API (a CUPS-integrated print service built with Go and Gin). Refer to [SAST Printer](https://github.com/NJUPT-SAST/sast-printer)

## License

This project is licensed under the [Apache License 2.0](LICENSE).
