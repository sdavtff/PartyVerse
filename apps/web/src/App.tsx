import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/AuthPage';
import { Home } from './pages/Home';
import { ProfilePage } from './pages/ProfilePage';
import { Notice, RoomPage } from './pages/RoomPage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="entrar" element={<AuthPage />} />
        <Route path="perfil" element={<ProfilePage />} />
        <Route path="sala/:code" element={<RoomPage />} />
        <Route
          path="*"
          element={
            <Notice
              title="Página não encontrada"
              text="Esse endereço não leva a lugar nenhum. Que tal começar uma partida?"
            />
          }
        />
      </Route>
    </Routes>
  );
}
