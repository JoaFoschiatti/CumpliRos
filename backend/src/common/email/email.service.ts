import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeText(value: unknown): string {
  return escapeHtml(String(value ?? ""));
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private from: string;
  private isEnabled: boolean;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>("RESEND_API_KEY");
    this.from =
      this.configService.get<string>("EMAIL_FROM") ||
      "CumpliRos <noreply@cumpliros.com>";

    // Only initialize Resend if API key is configured
    this.isEnabled = !!apiKey && !apiKey.startsWith("re_xxxx");

    if (this.isEnabled) {
      this.resend = new Resend(apiKey);
      this.logger.log("Email service initialized with Resend");
    } else {
      this.logger.warn(
        "Email service running in development mode (emails will be logged only)",
      );
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const { to, subject, html, text } = options;
    const recipients = Array.isArray(to) ? to : [to];

    // Development mode - just log the email
    if (!this.isEnabled || !this.resend) {
      this.logger.log("========================================");
      this.logger.log("[DEV EMAIL] Simulated email send:");
      this.logger.log(`  To: ${recipients.join(", ")}`);
      this.logger.log(`  From: ${this.from}`);
      this.logger.log(`  Subject: ${subject}`);
      this.logger.log(
        `  Body: [omitted] (${text ? "text" : "html"} length=${(text || html || "").length})`,
      );
      this.logger.log("========================================");
      return true;
    }

    const basePayload = {
      from: this.from,
      to: recipients,
      subject,
    };

    try {
      let sendResult: {
        data: { id?: string } | null;
        error: { message: string } | null;
      };
      if (html) {
        sendResult = await this.resend.emails.send({
          ...basePayload,
          html,
          ...(text ? { text } : {}),
        });
      } else if (text) {
        sendResult = await this.resend.emails.send({ ...basePayload, text });
      } else {
        this.logger.error("Email payload missing html/text content");
        return false;
      }

      const { data, error } = sendResult;

      if (error) {
        this.logger.error(`Failed to send email: ${error.message}`, error);
        return false;
      }

      this.logger.log(
        `Email sent successfully: ${data?.id} to ${recipients.join(", ")}`,
      );
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error sending email: ${errorMessage}`, errorStack);
      return false;
    }
  }

  /**
   * Send an upcoming obligations notification email
   */
  async sendUpcomingObligationsEmail(
    to: string,
    recipientName: string,
    organizationName: string,
    obligations: Array<{ title: string; daysUntilDue: number }>,
    urgentCount: number,
  ): Promise<boolean> {
    const subject =
      urgentCount > 0
        ? `[URGENTE] ${urgentCount} obligaciones próximas a vencer - ${organizationName}`
        : `${obligations.length} obligaciones próximas a vencer - ${organizationName}`;

    const obligationsList = obligations
      .map(
        (o) =>
          `<li><strong>${safeText(o.title)}</strong> - vence en ${o.daysUntilDue} días</li>`,
      )
      .join("\n");

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Hola ${safeText(recipientName)},</h2>

        <p>Tienes <strong>${obligations.length}</strong> obligación(es) próxima(s) a vencer en <strong>${safeText(organizationName)}</strong>:</p>

        <ul style="background: #f5f5f5; padding: 20px; border-radius: 8px; list-style: none;">
          ${obligationsList}
        </ul>

        <p>Por favor, revisa el panel de cumplimiento para más detalles.</p>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Saludos,<br>
          <strong>CumpliRos</strong>
        </p>
      </div>
    `;

    const text = `Hola ${recipientName},\n\nTienes ${obligations.length} obligación(es) próxima(s) a vencer en ${organizationName}:\n\n${obligations.map((o) => `- ${o.title} (vence en ${o.daysUntilDue} días)`).join("\n")}\n\nPor favor, revisa el panel de cumplimiento para más detalles.\n\nSaludos,\nCumpliRos`;

    return this.sendEmail({ to, subject, html, text });
  }

  /**
   * Send an overdue obligations notification to organization owners
   */
  async sendOverdueObligationsEmail(
    to: string,
    organizationName: string,
    obligations: Array<{ title: string; ownerName: string }>,
  ): Promise<boolean> {
    const subject = `[VENCIDO] ${obligations.length} obligaciones vencidas - ${organizationName}`;

    const obligationsList = obligations
      .map(
        (o) =>
          `<li><strong>${safeText(o.title)}</strong> - responsable: ${safeText(o.ownerName)}</li>`,
      )
      .join("\n");

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">⚠️ Alerta: Obligaciones Vencidas</h2>

        <p>Hay <strong>${obligations.length}</strong> obligación(es) vencida(s) en <strong>${safeText(organizationName)}</strong>:</p>

        <ul style="background: #fef2f2; padding: 20px; border-radius: 8px; list-style: none; border-left: 4px solid #dc2626;">
          ${obligationsList}
        </ul>

        <p><strong>Por favor, tome acción inmediata.</strong></p>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Saludos,<br>
          <strong>CumpliRos</strong>
        </p>
      </div>
    `;

    const text = `Alerta: Obligaciones Vencidas\n\nHay ${obligations.length} obligación(es) vencida(s) en ${organizationName}:\n\n${obligations.map((o) => `- ${o.title} (responsable: ${o.ownerName})`).join("\n")}\n\nPor favor, tome acción inmediata.\n\nSaludos,\nCumpliRos`;

    return this.sendEmail({ to, subject, html, text });
  }

  /**
   * Send a review required notification
   */
  async sendReviewRequiredEmail(
    to: string,
    reviewerName: string,
    organizationName: string,
    obligationTitle: string,
  ): Promise<boolean> {
    const subject = `Revisión requerida: ${obligationTitle} - ${organizationName}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Hola ${safeText(reviewerName)},</h2>

        <p>Se requiere tu revisión para la siguiente obligación:</p>

        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #0284c7;">
          <p><strong>Obligación:</strong> ${safeText(obligationTitle)}</p>
          <p><strong>Organización:</strong> ${safeText(organizationName)}</p>
        </div>

        <p>Por favor, accede al panel de cumplimiento para revisar y aprobar o rechazar.</p>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Saludos,<br>
          <strong>CumpliRos</strong>
        </p>
      </div>
    `;

    const text = `Hola ${reviewerName},\n\nSe requiere tu revisión para la siguiente obligación:\n\nObligación: ${obligationTitle}\nOrganización: ${organizationName}\n\nPor favor, accede al panel de cumplimiento para revisar y aprobar o rechazar.\n\nSaludos,\nCumpliRos`;

    return this.sendEmail({ to, subject, html, text });
  }

  /**
   * Send a review rejected notification
   */
  async sendReviewRejectedEmail(
    to: string,
    ownerName: string,
    organizationName: string,
    obligationTitle: string,
    reviewerName: string,
    comment: string,
  ): Promise<boolean> {
    const subject = `Revisión rechazada: ${obligationTitle} - ${organizationName}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Hola ${safeText(ownerName)},</h2>

        <p>La revisión de la siguiente obligación ha sido rechazada:</p>

        <div style="background: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626;">
          <p><strong>Obligación:</strong> ${safeText(obligationTitle)}</p>
          <p><strong>Revisado por:</strong> ${safeText(reviewerName)}</p>
          <p><strong>Observaciones:</strong> ${safeText(comment)}</p>
        </div>

        <p>Por favor, corrige las observaciones y vuelve a enviar para revisión.</p>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Saludos,<br>
          <strong>CumpliRos</strong>
        </p>
      </div>
    `;

    const text = `Hola ${ownerName},\n\nLa revisión de la siguiente obligación ha sido rechazada:\n\nObligación: ${obligationTitle}\nRevisado por: ${reviewerName}\nObservaciones: ${comment}\n\nPor favor, corrige las observaciones y vuelve a enviar para revisión.\n\nSaludos,\nCumpliRos`;

    return this.sendEmail({ to, subject, html, text });
  }

  /**
   * Send an invitation email
   */
  async sendInvitationEmail(
    to: string,
    organizationName: string,
    inviterName: string,
    role: string,
    inviteToken: string,
    baseUrl: string,
  ): Promise<boolean> {
    let inviteUrl: string;
    try {
      const parsed = new URL(baseUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("Invalid baseUrl protocol");
      }
      const origin = parsed.origin;
      const url = new URL("/auth/accept-invitation", origin);
      url.searchParams.set("token", inviteToken);
      inviteUrl = url.toString();
    } catch {
      inviteUrl = `http://localhost:3000/auth/accept-invitation?token=${encodeURIComponent(inviteToken)}`;
    }
    const subject = `Invitación a ${organizationName} - CumpliRos`;

    const roleLabels: Record<string, string> = {
      OWNER: "Propietario",
      ADMIN: "Administrador",
      ACCOUNTANT: "Contador",
      MANAGER: "Encargado",
    };

    const roleLabel = roleLabels[role] || role;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Has sido invitado a CumpliRos</h2>

        <p><strong>${safeText(inviterName)}</strong> te ha invitado a unirte a <strong>${safeText(organizationName)}</strong> como <strong>${safeText(roleLabel)}</strong>.</p>

        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
          <p>CumpliRos es una plataforma para gestionar obligaciones municipales de comercios y PyMEs.</p>
          <a href="${inviteUrl}" style="display: inline-block; background: #0284c7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 15px;">
            Aceptar Invitación
          </a>
        </div>

        <p style="color: #666; font-size: 14px;">
          Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
          <a href="${inviteUrl}" style="color: #0284c7;">${inviteUrl}</a>
        </p>

        <p style="color: #666; font-size: 14px;">
          Esta invitación expira en 7 días.
        </p>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Saludos,<br>
          <strong>CumpliRos</strong>
        </p>
      </div>
    `;

    const text = `Has sido invitado a CumpliRos\n\n${inviterName} te ha invitado a unirte a ${organizationName} como ${roleLabel}.\n\nPara aceptar la invitación, visita: ${inviteUrl}\n\nEsta invitación expira en 7 días.\n\nSaludos,\nCumpliRos`;

    return this.sendEmail({ to, subject, html, text });
  }

  /**
   * Send a password reset email
   */
  async sendPasswordResetEmail(
    to: string,
    recipientName: string,
    resetUrl: string,
  ): Promise<boolean> {
    const subject = "Restablecer contraseña - CumpliRos";

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Hola ${safeText(recipientName)},</h2>

        <p>Recibimos una solicitud para restablecer tu contraseña. Si no fuiste vos, podés ignorar este email.</p>

        <p>
          <a href="${safeText(resetUrl)}" style="background: #2563eb; color: #fff; padding: 10px 16px; text-decoration: none; border-radius: 6px;">
            Restablecer contraseña
          </a>
        </p>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Este enlace expira en 1 hora.
        </p>

        <p style="color: #666; font-size: 14px;">
          Saludos,<br>
          <strong>CumpliRos</strong>
        </p>
      </div>
    `;

    const text = `Hola ${recipientName},\n\nRecibimos una solicitud para restablecer tu contraseña. Si no fuiste vos, podés ignorar este email.\n\nRestablecer contraseña: ${resetUrl}\n\nEste enlace expira en 1 hora.\n\nSaludos,\nCumpliRos`;

    return this.sendEmail({ to, subject, html, text });
  }
}
