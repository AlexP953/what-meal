import AccessScreen from "../components/AccessScreen";

export default function SessionUnavailable({ retry }: { retry?: () => void }) {
  return (
    <AccessScreen title="Diario de comidas" description="Comprueba tu sesión para volver al diario.">
      <p role="alert" className="app-feedback app-error mt-4">No pudimos verificar tu sesión. El servicio no está disponible en este momento.</p>
      <form action="/meals" className="mt-4" onSubmit={retry ? event => {
        event.preventDefault();
        retry();
      } : undefined}>
        <button type="submit" className="app-button app-button-primary">Volver a comprobar la sesión</button>
      </form>
    </AccessScreen>
  );
}
