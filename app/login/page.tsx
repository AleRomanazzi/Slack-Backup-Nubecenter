import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

function errorText(error?: string): string | null {
  if (!error) {
    return null;
  }

  if (error === "missing_fields") {
    return "Completá usuario y contraseña.";
  }

  if (error === "invalid_credentials") {
    return "Credenciales inválidas.";
  }

  return "No se pudo iniciar sesión.";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getCurrentSession();
  if (session) {
    redirect("/");
  }

  const params = (await searchParams) ?? {};
  const message = errorText(params.error);

  return (
    <main className="loginShell">
      <section className="loginCard" aria-label="Formulario de inicio de sesión">
        <Image src="/nubecenter-logo.svg" alt="Nubecenter" width={220} height={48} className="brandLogo" priority />
        <h1>Iniciar sesión</h1>
        <p className="subtle">Acceso exclusivo para administrador.</p>
        <form className="filters loginForm" action="/api/auth/login" method="post">
          <label htmlFor="username">Usuario</label>
          <input id="username" name="username" defaultValue="admin" autoComplete="username" />
          <label htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" autoComplete="current-password" />
          <button type="submit">Ingresar</button>
        </form>
        {message && <p className="loginError">{message}</p>}
      </section>
    </main>
  );
}
