import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/AuthPage';
import { GameDetailPage } from './pages/GameDetailPage';
import { GamesPage } from './pages/GamesPage';
import { HelpPage } from './pages/HelpPage';
import { Home } from './pages/Home';
import { ProfilePage } from './pages/ProfilePage';
import { PublicProfilePage } from './pages/PublicProfilePage';
import { RankingPage } from './pages/RankingPage';
import { Notice, RoomPage } from './pages/RoomPage';
import { RoomsPage } from './pages/RoomsPage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="jogos" element={<GamesPage />} />
        <Route path="jogos/:slug" element={<GameDetailPage />} />
        <Route path="salas" element={<RoomsPage />} />
        <Route path="ranking" element={<RankingPage />} />
        <Route path="ajuda" element={<HelpPage />} />
        <Route path="entrar" element={<AuthPage />} />
        <Route path="perfil" element={<ProfilePage />} />
        <Route path="jogador/:id" element={<PublicProfilePage />} />
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
