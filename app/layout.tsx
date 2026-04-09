import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Calculadora de Inversión Inmobiliaria MX',
  description: 'Analiza flujo, deuda y patrimonio para compra de propiedades en renta en México.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
