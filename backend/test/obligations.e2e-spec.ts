import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";

describe("Obligations (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let organizationId: string;
  let userId: string;

  const testUser = {
    email: "obligations-e2e@example.com",
    password: "TestPassword123!",
    fullName: "Obligations E2E User",
  };

  const testOrganization = {
    cuit: "20-99999999-9",
    name: "E2E Test Organization",
    plan: "BASIC",
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Cleanup
    try {
      if (organizationId) {
        await prisma.organization.delete({ where: { id: organizationId } });
      }
      await prisma.user.deleteMany({ where: { email: testUser.email } });
    } catch (e) {
      // Ignore cleanup errors
    }
    await app.close();
  });

  beforeEach(async () => {
    // Setup: Register user and create organization
    try {
      await prisma.organization.deleteMany({
        where: { cuit: testOrganization.cuit },
      });
      await prisma.user.deleteMany({ where: { email: testUser.email } });
    } catch (e) {
      // Ignore
    }

    // Register user
    const registerResponse = await request(app.getHttpServer())
      .post("/auth/register")
      .send(testUser);

    accessToken = registerResponse.body.accessToken;
    userId = registerResponse.body.user.id;

    // Create organization
    const orgResponse = await request(app.getHttpServer())
      .post("/organizations")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(testOrganization);

    organizationId = orgResponse.body.id;
  });

  describe("POST /organizations/:organizationId/obligations", () => {
    it("should create an obligation", async () => {
      const obligation = {
        title: "Test Tax Payment",
        description: "Monthly tax payment",
        type: "TAX",
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        ownerUserId: userId,
      };

      const response = await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/obligations`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(obligation)
        .expect(201);

      expect(response.body).toHaveProperty("id");
      expect(response.body.title).toBe(obligation.title);
      expect(response.body.type).toBe(obligation.type);
      expect(response.body.status).toBe("PENDING");
      expect(response.body).toHaveProperty("trafficLight");
    });

    it("should calculate traffic light correctly", async () => {
      // Obligation due in 5 days (should be RED)
      const redObligation = {
        title: "Urgent Payment",
        type: "TAX",
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        ownerUserId: userId,
      };

      const redResponse = await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/obligations`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(redObligation)
        .expect(201);

      expect(redResponse.body.trafficLight).toBe("RED");

      // Obligation due in 10 days (should be YELLOW)
      const yellowObligation = {
        title: "Medium Payment",
        type: "TAX",
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        ownerUserId: userId,
      };

      const yellowResponse = await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/obligations`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(yellowObligation)
        .expect(201);

      expect(yellowResponse.body.trafficLight).toBe("YELLOW");

      // Obligation due in 30 days (should be GREEN)
      const greenObligation = {
        title: "Future Payment",
        type: "TAX",
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        ownerUserId: userId,
      };

      const greenResponse = await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/obligations`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(greenObligation)
        .expect(201);

      expect(greenResponse.body.trafficLight).toBe("GREEN");
    });
  });

  describe("GET /organizations/:organizationId/obligations", () => {
    it("should return paginated obligations", async () => {
      // Create test obligations
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post(`/organizations/${organizationId}/obligations`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({
            title: `Obligation ${i}`,
            type: "TAX",
            dueDate: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            ownerUserId: userId,
          });
      }

      const response = await request(app.getHttpServer())
        .get(`/organizations/${organizationId}/obligations`)
        .set("Authorization", `Bearer ${accessToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(3);
      expect(response.body.meta).toHaveProperty("total", 3);
    });

    it("should filter by status", async () => {
      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/obligations`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          title: "Pending Obligation",
          type: "TAX",
          dueDate: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          ownerUserId: userId,
        });

      const response = await request(app.getHttpServer())
        .get(`/organizations/${organizationId}/obligations`)
        .set("Authorization", `Bearer ${accessToken}`)
        .query({ status: "PENDING" })
        .expect(200);

      expect(response.body.data.every((o: any) => o.status === "PENDING")).toBe(
        true,
      );
    });
  });

  describe("GET /organizations/:organizationId/obligations/dashboard", () => {
    it("should return dashboard statistics", async () => {
      // Create obligations with different due dates
      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/obligations`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          title: "Dashboard Test",
          type: "TAX",
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          ownerUserId: userId,
        });

      const response = await request(app.getHttpServer())
        .get(`/organizations/${organizationId}/obligations/dashboard`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("total");
      expect(response.body).toHaveProperty("overdue");
      expect(response.body).toHaveProperty("red");
      expect(response.body).toHaveProperty("yellow");
      expect(response.body).toHaveProperty("green");
      expect(response.body).toHaveProperty("completed");
      expect(response.body).toHaveProperty("upcoming7Days");
      expect(response.body).toHaveProperty("overdueList");
    });
  });

  describe("PATCH /organizations/:organizationId/obligations/:id/status", () => {
    it("should update obligation status", async () => {
      // Create obligation
      const createResponse = await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/obligations`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          title: "Status Update Test",
          type: "TAX",
          dueDate: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          ownerUserId: userId,
          requiredEvidenceCount: 0,
          requiresReview: false,
        });

      const obligationId = createResponse.body.id;

      // Update status to IN_PROGRESS
      const response = await request(app.getHttpServer())
        .patch(
          `/organizations/${organizationId}/obligations/${obligationId}/status`,
        )
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ status: "IN_PROGRESS" })
        .expect(200);

      expect(response.body.status).toBe("IN_PROGRESS");

      // Update status to COMPLETED
      const completedResponse = await request(app.getHttpServer())
        .patch(
          `/organizations/${organizationId}/obligations/${obligationId}/status`,
        )
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ status: "COMPLETED" })
        .expect(200);

      expect(completedResponse.body.status).toBe("COMPLETED");
      expect(completedResponse.body.trafficLight).toBe("GREEN");
    });

    it("should enforce evidence requirements for completion", async () => {
      const createResponse = await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/obligations`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          title: "Evidence Required Test",
          type: "TAX",
          dueDate: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          ownerUserId: userId,
          requiredEvidenceCount: 2,
          requiresReview: false,
        });

      const obligationId = createResponse.body.id;

      // Try to complete without evidence
      await request(app.getHttpServer())
        .patch(
          `/organizations/${organizationId}/obligations/${obligationId}/status`,
        )
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ status: "COMPLETED" })
        .expect(400);
    });
  });

  describe("DELETE /organizations/:organizationId/obligations/:id", () => {
    it("should delete an obligation", async () => {
      const createResponse = await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/obligations`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          title: "Delete Test",
          type: "TAX",
          dueDate: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          ownerUserId: userId,
        });

      const obligationId = createResponse.body.id;

      await request(app.getHttpServer())
        .delete(`/organizations/${organizationId}/obligations/${obligationId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(204);

      // Verify deletion
      await request(app.getHttpServer())
        .get(`/organizations/${organizationId}/obligations/${obligationId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(404);
    });
  });
});
