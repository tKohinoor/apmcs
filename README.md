APMCS — Agile Project Management and Collaboration System

A web-based project management application designed to help teams organize projects, manage sprints, track work items, and collaborate in one place.

Overview

APMCS provides a centralized workspace for managing software projects and coordinating team activities. Users can register, log in, create projects, and manage project-related work through a web interface.

Features
User Authentication — Register and log in securely with JWT-based authentication.
Project Management — Create projects with a name, unique key, and optional description.
Project Dashboard — View and access your projects from a centralized dashboard.
Sprint Management — Organize project work into sprints.
Work Item Management — Manage tasks and other work items associated with a project.
Team Collaboration — Manage project members.
Protected Routes — Restrict access to authenticated areas of the application.
REST API — Connect the frontend to the backend through API endpoints.
Tech Stack
Technology	Purpose
React	Frontend user interface
Vite	Frontend development server and build tool
React Router	Client-side routing
dnd-kit	Drag-and-drop interactions
Node.js	Backend runtime
Express.js	REST API
MongoDB	Database
Mongoose	MongoDB object modeling
JWT	Authentication
bcryptjs	Password hashing
Helmet	HTTP security headers
CORS	Cross-origin request configuration
Project Structure
apmcs/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── ...
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── app.js
│   │   └── server.js
│   ├── package.json
│   └── ...
└── README.md

Prerequisites

Before getting started, make sure you have installed:

Node.js — a version compatible with the dependencies in the project.
npm — included with Node.js.
MongoDB — a local MongoDB instance or a MongoDB Atlas database.
Git — to clone the repository.
Getting Started
1. Clone the repository
git clone https://github.com/tKohinoor/apmcs.git
cd apmcs

2. Configure the backend

Navigate to the server directory:

cd server
npm install


Create a .env file inside the server/ directory:

PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/apmcs
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173


Environment variables

Variable	Description
PORT	Port on which the backend server runs
MONGO_URI	MongoDB connection string
JWT_SECRET	Secret used to sign authentication tokens
JWT_EXPIRES_IN	Token expiration duration
CLIENT_URL	Frontend origin allowed by CORS

Update MONGO_URI if you use MongoDB Atlas or a different local database configuration. Use a strong, private JWT secret and never commit your .env file.

3. Start the backend

From the server/ directory, run:

npm run dev


The backend uses Node.js watch mode and loads environment variables from .env.

By default, the API server runs at:

http://localhost:5000

Check the server health endpoint:

GET http://localhost:5000/api/v1/health


A successful response looks like:

{
  "status": "ok",
  "message": "APMCS server is running"
}

4. Configure the frontend

Open a second terminal and navigate to the project root:

cd apmcs/client
npm install


Create a .env file inside the client/ directory:

VITE_API_URL=http://localhost:5000/api/v1


The frontend uses VITE_API_URL as the base URL for backend API requests.

5. Start the frontend

From the client/ directory, run:

npm run dev


Open the local URL printed by Vite, usually:

http://localhost:5173

Register an account or log in to access the project dashboard.

Available Scripts
Frontend

Run these commands from client/.

Command	Description
npm run dev	Start the Vite development server
npm run build	Build the frontend for production
npm run preview	Preview the production build
npm run lint	Run ESLint
Backend

Run these commands from server/.

Command	Description
npm run dev	Start the backend in watch mode
API Overview

The backend exposes a REST API under /api/v1.

Method	Endpoint	Description
GET	/api/v1/health	Check server health
POST	/api/v1/auth/register	Register a user
POST	/api/v1/auth/login	Authenticate a user
GET	/api/v1/auth/me	Retrieve the authenticated user
GET	/api/v1/projects	List projects
POST	/api/v1/projects	Create a project
GET	/api/v1/projects/:id	Retrieve project details
—	/api/v1/projects/:projectId/items	Work item routes
—	/api/v1/projects/:projectId/sprints	Sprint routes
—	/api/v1/projects/:projectId/members	Project member routes

Except for the health endpoint, protected resources require authentication. Requests from the frontend include the JWT in the Authorization header:

Authorization: Bearer <your_token>


Refer to the backend route and controller files for the supported methods and request payloads for each resource.

Development Workflow
Clone the repository and install dependencies for both applications.
Configure the backend and frontend environment variables.
Start MongoDB.
Run the backend and frontend in separate terminals.
Register or log in to the application.
Create a project and use the available project management features.
Troubleshooting

MongoDB connection failed

Verify that MongoDB is running.
Check that MONGO_URI is correct.
Confirm that your database is accessible.

Frontend cannot connect to the backend

Verify that the backend is running on the configured port.
Ensure VITE_API_URL points to the correct API base URL.
Confirm that CLIENT_URL matches the frontend origin.
Restart the Vite development server after changing environment variables.

Authentication errors

Check that JWT_SECRET is configured on the backend.
Log in again if your token has expired.
Ensure protected API requests include a valid bearer token.
Security Notes
Keep secrets and database credentials out of source control.
Use HTTPS and secure deployment settings in production.
Configure CORS to allow only trusted frontend origins.
Use a strong JWT secret and appropriate token expiration settings.
Restrict database access and use appropriate credentials.
Contributing

Contributions, bug reports, and feature suggestions are welcome.

Fork the repository.
Create a feature branch.
Make your changes and test them locally.
Commit your changes with a descriptive message.
Open a pull request describing your changes.
License

No project-specific license has been confirmed. Add a LICENSE file and update this section when the licensing terms have been decided.

Author

tKohinoor

GitHub: @tKohinoor
Repository: tKohinoor/apmcs

If you find this project useful, consider giving the repository a ⭐ on GitHub.
