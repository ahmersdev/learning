import swaggerJSDoc from "swagger-jsdoc";

const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Express Auth API",
      version: "1.0.0",
      description: "API documentation for auth + tasks endpoints",
    },
    servers: [{ url: "/api/v1", description: "API v1" }],
    tags: [
      { name: "Auth", description: "Authentication endpoints" },
      { name: "Users", description: "User profile endpoints" },
      { name: "Workspaces", description: "Workspace management endpoints" },
      {
        name: "Workspace Members",
        description: "Workspace membership management",
      },
      { name: "Projects", description: "Project management endpoints" },
      { name: "Tasks", description: "Task management within projects" },
      { name: "Comments", description: "Comments on tasks" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/routes/*.ts"],
});

export default swaggerSpec;
