# **App Name**: Med-iTrack

## Core Features:

- Request Creation (Manual): Admin users can manually create study requests by inputting patient and study details directly into a form.
- Request Creation (AI-assisted): Nurses and admins can upload medical orders (PDF/image), and the application uses Google Genkit and the gemini-1.5-flash-latest tool to extract patient name, ID, requested studies, and diagnosis. The data will be displayed to the user, allowing them to confirm it, correct it if there are mistakes, and submit it as a request.
- Real-time Dashboard: Display a real-time summary of pending studies in interactive cards, grouped by modality (ECO, RX, TAC, RMN) and clinical area (URG, HOSP, UCI, C.EXT). Cards act as filters.
- Dynamic Study Table: Show all study requests with columns for status, service, patient, study, and request date, with dynamic filters.
- Role-Based Access Control: Implement Firebase Authentication and access control based on user roles (administrator, nurse, technologist, transcriptionist).
- Status and Action Management: Each row in the study table has an action menu (edit, cancel, complete, generate report) that changes based on user role and study status.
- Report Generation: Authorized roles can attach a PDF report or generate one from plain text after a study is completed.

## Style Guidelines:

- Primary color: Yellow (#FFDA51) for main elements, buttons, and highlights. (HSL: 45, 100%, 66%)
- Accent color: Orange (#FFB047) for call-to-action buttons and important notifications. (HSL: 30, 100%, 64%)
- Background color: Light gray (#FAFAFA). (HSL: 0, 0%, 98%)
- Foreground color: Dark gray (HSL: 240, 10%, 3.9%) for main text.
- Border color: Subtle gray (HSL: 240, 5.9%, 90%) for borders and dividers.
- Headline Font: 'Space Grotesk' sans-serif for headers and titles. Note: currently only Google Fonts are supported.
- Body Font: 'Inter' sans-serif for all interface text to ensure maximum readability. Note: currently only Google Fonts are supported.
- Use Lucide React library for all icons, ensuring they are clean, geometric, and used to enhance clarity and usability.
- Implement a clean and structured layout with ample whitespace, using clear containers (cards) with subtle shadows and defined borders. Adaptive grid layout for the main dashboard.
- Subtle animations to show any actions.