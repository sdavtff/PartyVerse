import type { GameId } from '@partyverse/shared';

export interface GameGuide {
  id: GameId;
  slug: string;
  intro: string;
  steps: string[];
  scoring: string[];
  tips: string[];
  bestWith: string;
}

/** Conteúdo das páginas de cada jogo (/jogos/:slug). */
export const GAME_GUIDES: GameGuide[] = [
  {
    id: 'stop',
    slug: 'adedonha',
    intro:
      'O clássico STOP: uma letra é sorteada e todo mundo corre para preencher as categorias com palavras que comecem com ela.',
    steps: [
      'O anfitrião escolhe as categorias (Nome, Animal, Cidade… ou as suas próprias), rodadas e tempo.',
      'A letra é sorteada e o relógio começa.',
      'Quem completar tudo primeiro aperta STOP — os outros ganham alguns segundos para terminar.',
      'Na validação, uma categoria por vez, todos conferem as respostas e podem denunciar as inválidas.',
      'A maioria decide. Depois vem o placar da rodada e a próxima letra.',
    ],
    scoring: [
      'Resposta única: 10 pontos (padrão).',
      'Resposta repetida: 5 pontos.',
      'Em branco, fora da letra ou denunciada pela maioria: 0.',
      'O anfitrião pode mudar os valores.',
    ],
    tips: [
      'Respostas raras valem o dobro — fuja do óbvio!',
      'Acentos e maiúsculas não importam na comparação.',
    ],
    bestWith: '3 a 15 pessoas',
  },
  {
    id: 'draw',
    slug: 'rabisco',
    intro:
      'Uma pessoa desenha, o resto adivinha no chat. Quanto mais rápido você acerta, mais pontos ganha.',
    steps: [
      'Na sua vez, escolha uma entre 3 palavras.',
      'Desenhe com lápis, borracha, balde de tinta, formas e 16 cores. Nada de escrever letras!',
      'Os outros digitam palpites. Se chegar perto, aparece "quase!" só para quem chutou.',
      'Ao longo do tempo, algumas letras da palavra são reveladas como dica.',
      'A vez passa quando todos acertam ou o tempo acaba. Cada pessoa desenha uma vez por rodada.',
    ],
    scoring: [
      'Quem acerta: de 20 a 100 pontos, conforme a rapidez.',
      'Bônus de +20 para o 1º a acertar e +10 para o 2º.',
      'Quem desenha: +25 por pessoa que acertar.',
    ],
    tips: [
      'Comece pela forma geral e depois detalhe.',
      'Quem já acertou só conversa com quem também sabe — não estrague a surpresa.',
    ],
    bestWith: '3 a 12 pessoas',
  },
  {
    id: 'charades',
    slug: 'mimica',
    intro:
      'Imite sem falar! Perfeito para jogar numa chamada de vídeo ou com todo mundo na mesma sala.',
    steps: [
      'Na sua vez, escolha uma palavra ou ação.',
      'Faça a mímica na câmera da chamada (ou ao vivo). Nada de falar ou escrever.',
      'A turma chuta no chat do PartyVerse.',
      'Se ficar difícil, letras vão aparecendo como dica — ou você pode passar a vez.',
    ],
    scoring: [
      'Quem acerta: de 20 a 100 pontos, conforme a rapidez, com bônus para os primeiros.',
      'Quem imita: +25 por pessoa que acertar.',
    ],
    tips: ['O tema "Ações" é o mais divertido para mímica.', 'Use o corpo todo — exagere!'],
    bestWith: '3 a 15 pessoas, em chamada de vídeo',
  },
  {
    id: 'quiz',
    slug: 'quiz',
    intro:
      'Perguntas de múltipla escolha sobre vários temas. Acertar vale pontos — acertar rápido vale muito mais.',
    steps: [
      'O anfitrião escolhe o tema (ou misto), o número de perguntas e o tempo.',
      'Todos veem a mesma pergunta com 4 opções. Escolha uma — não dá para trocar.',
      'Quando todos respondem (ou o tempo acaba), a resposta certa aparece com uma curiosidade.',
    ],
    scoring: [
      'Acerto: de 500 a 1000 pontos, conforme a rapidez.',
      'A partir de 3 acertos seguidos, +100 de bônus por acerto.',
      'Erro ou tempo esgotado: 0 e a sequência zera.',
    ],
    tips: ['Leia todas as opções antes de clicar — pressa demais custa caro.'],
    bestWith: '2 a 50 pessoas',
  },
  {
    id: 'secretword',
    slug: 'palavra-secreta',
    intro:
      'Uma pessoa conhece a palavra e dá dicas curtas, uma de cada vez. Quanto menos dicas forem necessárias, mais pontos.',
    steps: [
      'Na sua vez, escolha a palavra secreta.',
      'Mande dicas de até 3 palavras. A dica não pode conter a palavra.',
      'Os outros chutam no chat. Cada dica nova diminui os pontos de quem acertar.',
      'O número máximo de dicas é definido pelo anfitrião.',
    ],
    scoring: [
      'Quem acerta: de 20 a 100 pontos pela rapidez, reduzidos a cada dica extra (até 40% do valor).',
      'Quem dá as dicas: +25 por pessoa que acertar.',
    ],
    tips: ['Comece com dicas mais amplas e vá afunilando.'],
    bestWith: '3 a 12 pessoas',
  },
  {
    id: 'impostor',
    slug: 'impostor',
    intro:
      'Todos recebem o mesmo local secreto — menos um. Façam perguntas para descobrir quem está blefando.',
    steps: [
      'Cada um recebe uma carta: o local e um papel (ex.: Praia, Salva-vidas). O impostor não sabe o local.',
      'Na discussão, façam perguntas uns aos outros sobre o local, sem entregá-lo.',
      'Quando a maioria pedir, começa a votação secreta.',
      'O impostor pode tentar adivinhar o local a qualquer momento.',
    ],
    scoring: [
      'Impostor descoberto: +2 para cada jogador comum, +1 extra para quem votou certo.',
      'Impostor escapou ou adivinhou o local: +4 para o impostor.',
      'Impostor chutou o local errado: +2 para cada jogador comum.',
    ],
    tips: [
      'Perguntas vagas demais denunciam o impostor; óbvias demais entregam o local.',
      'Melhor em chamada de voz.',
    ],
    bestWith: '4 a 12 pessoas',
  },
  {
    id: 'mostlikely',
    slug: 'quem-e-mais-provavel',
    intro:
      'Aparece uma frase — "Quem é mais provável de dormir no cinema?" — e todo mundo vota em alguém da sala. Risada garantida.',
    steps: [
      'A cada rodada aparece uma frase nova.',
      'Toque em quem você acha mais provável (pode votar em você mesmo!). Dá para trocar o voto até o tempo acabar.',
      'No fim, o mais votado é revelado com o gráfico de votos.',
      'O anfitrião pode escrever frases próprias — sobre a turma, piadas internas, o que quiser.',
    ],
    scoring: [
      'Votou na pessoa mais votada: +100.',
      'Ser a pessoa mais votada: +50.',
      'Empate: todos os mais votados contam.',
    ],
    tips: ['Ótimo para aquecer a festa antes de jogos mais disputados.'],
    bestWith: '4 a 20 pessoas',
  },
  {
    id: 'truthdare',
    slug: 'verdade-ou-desafio',
    intro:
      'O clássico, em versão leve: na sua vez, escolha responder uma verdade ou cumprir um desafio. A turma decide se valeu.',
    steps: [
      'Uma pessoa por vez escolhe: Verdade ou Desafio (se demorar, o jogo sorteia).',
      'Aparece a carta. Responda em voz alta, na chamada de vídeo ou no chat.',
      'Toque em "Pronto!" — os outros votam 👍 cumpriu ou 👎 não valeu.',
      'Não quer? Dá para passar a vez, mas sem pontos.',
    ],
    scoring: [
      'Verdade aceita pela maioria: +100.',
      'Desafio aceito pela maioria: +150.',
      'Empate nos votos conta como cumprido.',
    ],
    tips: [
      'As cartas são pensadas para qualquer turma e funcionam por vídeo.',
      'O anfitrião pode adicionar verdades e desafios próprios — mantenha leve e respeitoso!',
    ],
    bestWith: '3 a 10 pessoas, em chamada de vídeo',
  },
  {
    id: 'twotruths',
    slug: 'duas-verdades-e-uma-mentira',
    intro:
      'Cada um escreve três frases sobre si: duas verdadeiras e uma mentira. Depois, a turma tenta descobrir qual é a mentira de cada um.',
    steps: [
      'Todos escrevem as três frases ao mesmo tempo e marcam qual é a mentira.',
      'Uma pessoa por vez tem as frases mostradas (em ordem embaralhada).',
      'Os outros escolhem qual acham que é a mentira.',
      'A mentira é revelada junto com quem caiu nela.',
    ],
    scoring: ['Achou a mentira: +100.', 'Autor: +50 por cada pessoa enganada.'],
    tips: [
      'Verdades surpreendentes enganam mais que mentiras mirabolantes.',
      'Ótimo para grupos que estão se conhecendo.',
    ],
    bestWith: '3 a 12 pessoas',
  },
  {
    id: 'hangman',
    slug: 'forca',
    intro:
      'A clássica forca, em turnos: cada um chuta uma letra; acertou, joga de novo. Dá para jogar sozinho ou com a turma.',
    steps: [
      'Uma palavra secreta é sorteada (do tema escolhido, sua lista ou criada pela IA).',
      'Na sua vez, escolha uma letra ou chute a palavra inteira.',
      'Letra certa aparece em todos os lugares e você continua; errada tira uma vida de todos e passa a vez.',
      'Se as vidas acabarem, a forca fica completa e ninguém pontua na palavra.',
    ],
    scoring: [
      'Letra certa: 10 pontos por vez que aparece.',
      'Revelar a última letra: +30.',
      'Chutar a palavra certa: +30 e +10 por letra que ainda faltava.',
    ],
    tips: ['Vogais primeiro!', 'Acentos não importam: "a" revela "á", "ã" e "â".'],
    bestWith: '1 a 8 pessoas',
  },
  {
    id: 'tictactoe',
    slug: 'jogo-da-velha',
    intro:
      'Duelo rápido de jogo da velha, em melhor de 3, 5 ou mais. Quem não joga assiste e torce.',
    steps: [
      'Jogam os dois primeiros da lista de jogadores (os outros podem marcar "Só assistir").',
      'X começa; quem joga de X troca a cada partida.',
      'Faça uma linha de três (reta ou diagonal) para vencer.',
      'Se o tempo da jogada acabar, a casa é escolhida automaticamente.',
    ],
    scoring: ['Vitória: 3 pontos.', 'Velha (empate): 1 ponto para cada.'],
    tips: ['Comece pelo centro ou por um canto.'],
    bestWith: '2 jogadores (+ torcida)',
  },
  {
    id: 'checkers',
    slug: 'damas',
    intro: 'Damas com as regras brasileiras, contra um amigo, com relógio por lance.',
    steps: [
      'Brancas começam; quem joga de brancas troca a cada partida.',
      'Peão anda uma casa na diagonal para a frente e captura para frente e para trás.',
      'Capturar é obrigatório — e, se houver mais de uma opção, vale a que pega mais peças.',
      'Peão que termina o lance na última fileira vira dama, que anda e captura várias casas.',
      'Ganha quem capturar todas as peças ou deixar o adversário sem jogadas.',
    ],
    scoring: [
      'Vitória: 3 pontos.',
      'Empate (20 lances só de damas sem captura): 1 ponto para cada.',
    ],
    tips: ['Toque na peça e veja os pontinhos verdes: são os destinos possíveis.'],
    bestWith: '2 jogadores (+ torcida)',
  },
  {
    id: 'telephone',
    slug: 'telefone-sem-fio',
    intro:
      'O telefone sem fio com desenhos: uma frase vira desenho, que vira outra frase, que vira outro desenho… e no fim todo mundo ri do resultado.',
    steps: [
      'Cada pessoa escreve uma frase (ou pede uma ideia 🎲).',
      'Os cadernos giram: você recebe a frase de alguém e desenha.',
      'No passo seguinte, outra pessoa vê só o desenho e descreve o que acha que é.',
      'Escrever e desenhar se alternam até cada caderno passar por todos.',
      'No fim, os cadernos aparecem página por página. Curta as melhores!',
    ],
    scoring: ['Página entregue: 5 pontos.', 'Cada ❤️ recebido: 10 pontos.'],
    tips: ['Frases absurdas rendem as melhores revelações.', 'Desenhe rápido: o tempo voa!'],
    bestWith: '4 a 12 pessoas',
  },
  {
    id: 'spies',
    slug: 'espioes',
    intro:
      'Dois times de espiões disputam 25 cartas. Só o mestre de cada time sabe quais são as suas — e ele só pode dar uma palavra de dica por vez.',
    steps: [
      'Os jogadores são divididos em 🔴 e 🔵; cada time tem um mestre 🕶️ (troca a cada partida).',
      'O mestre vê a cor de todas as cartas e dá uma dica: uma palavra + um número (ex.: "MAR 2").',
      'O time escolhe as cartas. Pode chutar até o número da dica + 1.',
      'Carta neutra ou do adversário encerra a vez. A carta do assassino 💀 faz o time perder.',
      'Ganha o time que revelar todas as suas cartas primeiro.',
    ],
    scoring: [
      'Carta do seu time revelada por você: 1 ponto.',
      'Time vencedor: 5 pontos para cada integrante.',
    ],
    tips: [
      'A dica não pode ser (nem conter) uma palavra da mesa.',
      'Dica "∞" deixa o time chutar até errar.',
    ],
    bestWith: '4 a 10 pessoas, em chamada de voz',
  },
];

export const guideBySlug = (slug: string) => GAME_GUIDES.find((g) => g.slug === slug);
export const guideById = (id: string) => GAME_GUIDES.find((g) => g.id === id);
