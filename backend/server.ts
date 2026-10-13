import express, { Request, Response } from 'express';
import { GamAuthClient } from '../src/lib';

/**
 * Servidor Backend de Ejemplo (Node.js + Express)
 * Demuestra la separación del backend y cómo consumir la librería @genexus/gam-auth
 * en servicios de servidor (APIs protegidas, microservicios, etc.).
 */

const app = express();
const PORT = process.env.BACKEND_PORT || 4000;

app.use(express.json());

// Instancia del cliente GAM en backend (puede usar GAM_CLIENT_SECRET confidencial)
const gamBackendClient = new GamAuthClient({
  baseUrl: process.env.GAM_BASE_URL || '',
  clientId: process.env.GAM_CLIENT_ID || '',
  clientSecret: process.env.GAM_CLIENT_SECRET, // Seguro en backend
});

/**
 * Middleware para validar que la petición incluye un token Bearer válido de GAM
 */
async function requireGamAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Cabecera Authorization: Bearer <token> requerida.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Validar el token directamente consultando /userinfo en GAM
    const result = await gamBackendClient.getUserInfo(token);
    if (!result.success || !result.data) {
      return res.status(401).json({
        error: 'InvalidToken',
        message: 'El token proporcionado no es válido o ha expirado en GAM.',
      });
    }

    // Inyectar el usuario validado en la petición
    (req as any).gamUser = result.data;
    next();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: 'ServerError', message });
  }
}

/**
 * Endpoint de estado del backend
 */
app.get('/api/backend/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'GAM Node.js Backend Service',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Endpoint protegido por token de GAM
 */
app.get('/api/backend/profile', requireGamAuth, (req: Request, res: Response) => {
  const user = (req as any).gamUser;
  res.json({
    message: 'Acceso autorizado al backend de GeneXus GAM',
    user,
  });
});

export default app;
