export interface Passo {
  alvo: string | null
  titulo: string
  texto: string
  tela?: 0 | 1 | 2 | 3 | 4
  esperar?: 'ajustes' | 'grade'
}

export const PASSOS: readonly Passo[] = [
  {
    tela: 0,
    alvo: '[data-tour="home"]',
    titulo: 'Esta é a tela inicial',
    texto:
      'O Pulse instala vários programas de uma vez, em sequência, sem você clicar em cada instalador. Daqui saem quatro etapas, e este passo a passo percorre todas elas. Dá para sair a qualquer momento pelo "pular".',
  },
  {
    tela: 1,
    alvo: '[data-tour="discos"]',
    titulo: '1. Onde vai ser instalado',
    texto:
      'Escolha o disco antes de qualquer coisa. Enquanto não houver um verificado, as outras etapas ficam trancadas: não faz sentido escolher programas sem saber onde eles vão. O que você escolher fica guardado para a próxima vez.',
  },
  {
    tela: 1,
    alvo: '[data-tour="checks"]',
    titulo: 'O que é conferido antes',
    texto:
      'Versão do Windows, instalador do sistema, internet, espaço livre e virtualização. Cartão vermelho tranca o caminho, amarelo só avisa. O espaço é medido no disco escolhido e também no do Windows, porque todo instalador escreve nos dois.',
  },
  {
    tela: 2,
    alvo: '[data-tour="combos"]',
    titulo: '2. Comece por um combo',
    texto:
      'Cada combo marca um conjunto pronto de uma vez, como o essencial ou o setup gamer. Ele troca a seleção inteira, então serve de ponto de partida: depois é só marcar e desmarcar o que quiser.',
  },
  {
    tela: 2,
    alvo: '[data-tour="busca"]',
    titulo: 'Ou procure pelo nome',
    texto:
      'A busca acha por nome e por categoria. O que já está no seu PC aparece marcado e travado, para você não pedir a mesma coisa duas vezes.',
  },
  {
    tela: 2,
    alvo: '[data-tour="ajustes-steam"]',
    titulo: 'Agora clique neste botão',
    texto:
      'A Steam é o programa com mais opções do catálogo, então serve de exemplo. Abra os ajustes dela para eu te mostrar o que dá para customizar. Eu continuo lá dentro.',
    esperar: 'ajustes',
  },
  {
    alvo: '[data-tour="aj-disco"]',
    titulo: 'Um disco só para ele',
    texto:
      'Por padrão todo programa vai para o disco geral, o da etapa 1. Aqui você tira um programa dessa regra sem mexer nos outros, o que ajuda quando um deles é grande demais para o disco do sistema.',
  },
  {
    alvo: '[data-tour="aj-inicio"]',
    titulo: 'Abrir junto com o Windows',
    texto:
      'Já vem marcado no que está valendo hoje no seu PC, lido do mesmo lugar que o Gerenciador de Tarefas usa. Se você escolher o lado que já está ativo, nada é gravado: não há mudança a fazer.',
  },
  {
    alvo: '[data-tour="aj-kind"]',
    titulo: 'E o que é só daquele programa',
    texto:
      'A Steam mostra a sua biblioteca, lida da máquina, sem pedir senha nem chave. Cada programa tem a sua seção: extensões no VS Code, linguagens no Visual Studio, conta no Git, navegador padrão nos navegadores, jogos da Riot depois do cliente.',
  },
  {
    alvo: '[data-tour="aj-voltar"]',
    titulo: 'Volte para a seleção',
    texto:
      'O que você marcou fica guardado no cartão do programa e aparece resumido embaixo do nome dele. Clique aqui para voltar que o passo a passo continua.',
    esperar: 'grade',
  },
  {
    tela: 2,
    alvo: '[data-tour="rodape"]',
    titulo: 'Depois é só mandar',
    texto:
      'O rodapé mostra quantos programas, quanto vai baixar e uma estimativa de tempo. A partir daqui a fila cuida do resto.',
  },
  {
    tela: 3,
    alvo: '[data-tour="3"]',
    titulo: '3. A fila anda sozinha',
    texto:
      'Até três programas ao mesmo tempo, cada um mostrando em qual etapa está: baixar, instalar, ajustar, pronto. Dá para cancelar um sem parar os outros, e para voltar à seleção e acrescentar mais no meio do caminho.',
  },
  {
    alvo: null,
    titulo: 'Pode sair de perto',
    texto:
      'Se algo falhar ou precisar de você, o Windows avisa com uma notificação e um som, e o ícone na barra de tarefas ganha uma marca: vermelha quando algo falhou, amarela quando a fila está esperando a sua resposta.',
  },
  {
    tela: 4,
    alvo: '[data-tour="4"]',
    titulo: '4. O que aconteceu',
    texto:
      'O resumo separa o que ficou pronto, o que só termina depois de reiniciar, o que precisa de você e o que ficou de fora, com o motivo de cada um. É daqui que sai o reinício, com contagem e chance de desistir.',
  },
  {
    alvo: '[data-tour="ajuda"]',
    titulo: 'Chegamos ao fim',
    texto:
      'Este passo a passo abre sozinho na primeira vez. Depois, é por aqui, e ele percorre tudo de novo do começo. O disco escolhido fica guardado; a conta do Git não, ela é lida da sua máquina toda vez que você abre os ajustes.',
  },
]
