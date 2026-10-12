APMCS 🚀
Agile Project Management and Collaboration System

A full-stack web application for agile project management, sprint planning, work item tracking, and team collaboration.

🚧 Project Status: Under Development

APMCS is a work in progress. The application is being developed incrementally, and features, interfaces, and APIs are subject to change. This repository showcases the project's ongoing development and evolution.
📖 About the Project

Managing software projects involves coordinating team members, organizing tasks, planning sprints, and tracking progress. APMCS aims to bring these activities together in a single, centralized platform.

The project is being developed as a team effort to explore and implement full-stack web development concepts, REST API design, database integration, authentication, and agile project management workflows.

The long-term vision is to build a platform that helps development teams organize their work, maintain visibility into project progress, and collaborate more effectively.

✨ Planned Features

The following features represent the project's development goals. Their implementation status may vary as development progresses.

User Authentication — User registration, login, and secure authentication.
Project Management — Create and organize projects with relevant details.
Project Dashboard — A centralized view of projects and their information.
Sprint Management — Organize work into manageable development sprints.
Work Item Tracking — Create and manage tasks and other project work items.
Team Management — Organize project members and support team collaboration.
Interactive Workflows — Explore drag-and-drop interactions for managing work.
Protected Resources — Restrict access to authenticated users where required.
🛠️ Tech Stack

APMCS uses a JavaScript-based full-stack architecture.

Technology	Purpose
React	Building the user interface
Vite	Frontend development and build tooling
React Router	Client-side navigation
dnd-kit	Drag-and-drop interactions
Node.js	Backend runtime
Express.js	REST API development
MongoDB	Data persistence
Mongoose	MongoDB data modeling
JSON Web Tokens (JWT)	Authentication
bcryptjs	Password hashing
Helmet	HTTP security headers
CORS	Cross-origin request configuration
🏗️ Architecture

APMCS follows a client-server architecture in which the React frontend communicates with the Express backend through HTTP API requests.

flowchart TD
    U[User] --> C[React Frontend]
    C --> R[React Router]
    C -->|HTTP Requests| A[Express REST API]
    A --> M[Authentication Middleware]
    A --> S[Application Logic]
    S --> D[(MongoDB)]
    D --> S
    S --> A
    A -->|JSON Responses| C


The architecture is intended to separate the user interface, API layer, application logic, and data storage, making the application easier to maintain and extend as development continues.

📁 Project Structure

The repository is organized into separate frontend and backend applications.

apmcs/
├── client/
│   └── src/
│       ├── components/
│       ├── context/
│       ├── pages/
│       ├── services/
│       ├── App.jsx
│       └── main.jsx
├── server/
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── models/
│       ├── routes/
│       ├── app.js
│       └── server.js
└── README.md


Note: The directory layout above describes the intended organization; individual files and modules may change as the project evolves.

🚀 Getting Started

Want to explore the current development version? Follow these steps to set up the project locally.

Prerequisites

Make sure you have the following installed:

Node.js
npm
MongoDB or a MongoDB Atlas account
Git
1. Clone the Repository
git clone https://github.com/tKohinoor/apmcs.git
cd apmcs

2. Set Up the Backend
cd server
npm install


Create a .env file in the server directory and configure the environment variables required by the current backend implementation.

For example:

PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/apmcs
JWT_SECRET=your_secure_random_secret
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173


Adjust the variables according to the configuration used in the current codebase. Never commit actual secrets or database credentials.

3. Set Up the Frontend

Open a separate terminal from the project root:

cd client
npm install


If the frontend uses an API base URL environment variable, create a .env file in the client directory:

VITE_API_URL=http://localhost:5000/api/v1


Use the variable name and API URL expected by the current frontend implementation.

4. Run the Application

Start the backend using the development script configured in server/package.json. For example:

cd server
npm run dev


Then start the frontend in a separate terminal:

cd client
npm run dev


Open the local URL printed by Vite in your browser.

Development note: Commands and environment variables should be verified against the latest project configuration. The setup process may change as development progresses.
📊 Development Progress

APMCS is being built incrementally. The following roadmap outlines the intended development phases and can be updated as the team makes progress.

Phase 1 — Foundation
Establish the frontend and backend structure.
Configure database connectivity.
Set up API routing and application configuration.
Phase 2 — Authentication
Implement user registration and login.
Integrate password hashing and JWT authentication.
Add protected routes and authorization checks.
Phase 3 — Project Management
Implement project creation and retrieval.
Build the project dashboard.
Add project details and management workflows.
Phase 4 — Agile Workflows
Implement sprint management.
Develop work item tracking.
Explore interactive task management workflows.
Phase 5 — Team Collaboration
Implement project membership workflows.
Improve visibility into team and project information.
Phase 6 — Quality and Deployment
Improve validation and error handling.
Add automated tests.
Refine the UI and responsive behavior.
Prepare a deployment-ready release.

This roadmap is provisional. Checkboxes should be updated as work is completed, and phases may be revised as requirements evolve.

🧪 Testing and Quality

Testing and reliability are important parts of the development process. As the application evolves, the project can incorporate:

API validation and error-handling tests.
Authentication and authorization checks.
Frontend component and interaction tests.
Database operation tests.
End-to-end testing of core user workflows.

Testing coverage and available test scripts depend on the current development stage.

🔐 Security Considerations

Security is an important consideration throughout development.

Store credentials and secrets in environment variables.
Never commit .env files containing sensitive values.
Hash passwords instead of storing them in plain text.
Validate and sanitize incoming data where appropriate.
Protect private resources with authentication and authorization.
Configure CORS and HTTP security headers appropriately.

The security model will continue to evolve as additional features are implemented.

🤝 Team Development

APMCS is a collaborative team project. Development involves coordinating changes across the frontend, backend, database, and application workflows.

Contributions should aim to keep the code maintainable, follow the existing project structure, and avoid breaking established functionality.

Contribution Workflow
Create a branch for your feature or bug fix.
Make focused changes that align with the project's goals.
Test the affected functionality.
Commit changes with clear, descriptive messages.
Open a pull request for review and integration.
🔮 Future Scope

As development progresses, potential areas for improvement include:

More comprehensive sprint planning and work tracking.
Improved project analytics and progress visualization.
Enhanced team collaboration workflows.
Notifications and activity tracking.
More granular role-based access control.
Automated testing and continuous integration.
Production deployment and performance optimization.

These are possible future enhancements, not promises of features already available.

📌 Current Status

APMCS is an evolving project intended to demonstrate the design and development of a full-stack agile project management application.

The repository reflects ongoing work. Some functionality may be incomplete, experimental, or subject to refactoring. Feedback and suggestions are welcome as the project develops.

Repository: github.com/tKohinoor/apmcs

⭐ If you're interested in the project's progress, consider starring the repository and checking back as development continues.

Team BroCode
My Git commit and push test.