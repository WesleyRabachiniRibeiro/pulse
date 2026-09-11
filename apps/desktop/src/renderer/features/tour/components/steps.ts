export interface Step {
  target: string | null
  title: string
  text: string
  screen?: 0 | 1 | 2 | 3 | 4
  waitFor?: 'settings' | 'grid'
}

export const STEPS: readonly Step[] = [
  {
    screen: 0,
    target: '[data-tour="home"]',
    title: 'Esta é a tela inicial',
    text:
      'O Pulse instala vários programas de uma vez, em sequência, sem você clicar em cada instalador. Daqui saem quatro etapas, e este passo a passo percorre todas elas. Dá para sair a qualquer momento pelo "pular".',
  },
  {
    screen: 1,
    target: '[data-tour="discos"]',
    title: '1. Onde vai ser instalado',
    text:
      'Escolha o disco antes de qualquer coisa. Enquanto não houver um verificado, as outras etapas ficam trancadas: não faz sentido escolher programas sem saber onde eles vão. O que você escolher fica guardado para a próxima vez.',
  },
  {
    screen: 1,
    target: '[data-tour="checks"]',
    title: 'O que é conferido antes',
    text:
      'Versão do Windows, instalador do sistema, internet, espaço livre e virtualização. Cartão vermelho tranca o caminho, amarelo só avisa. O espaço é medido no disco escolhido e também no do Windows, porque todo instalador escreve nos dois.',
  },
  {
    screen: 2,
    target: '[data-tour="combos"]',
    title: '2. Comece por um combo',
    text:
      'Cada combo marca um conjunto pronto de uma vez, como o essencial ou o setup gamer. Ele troca a seleção inteira, então serve de ponto de partida: depois é só marcar e desmarcar o que quiser.',
  },
  {
    screen: 2,
    target: '[data-tour="busca"]',
    title: 'Ou procure pelo nome',
    text:
      'A busca acha por nome e por categoria. O que já está no seu PC aparece marcado e travado, para você não pedir a mesma coisa duas vezes.',
  },
  {
    screen: 2,
    target: '[data-tour="ajustes-steam"]',
    title: 'Agora clique neste botão',
    text:
      'A Steam é o programa com mais opções do catálogo, então serve de exemplo. Abra os ajustes dela para eu te mostrar o que dá para customizar. Eu continuo lá dentro.',
    waitFor: 'settings',
  },
  {
    target: '[data-tour="aj-disco"]',
    title: 'Um disco só para ele',
    text:
      'Por padrão todo programa vai para o disco geral, o da etapa 1. Aqui você tira um programa dessa regra sem mexer nos outros, o que ajuda quando um deles é grande demais para o disco do sistema.',
  },
  {
    target: '[data-tour="aj-inicio"]',
    title: 'Abrir junto com o Windows',
    text:
      'Já vem marcado no que está valendo hoje no seu PC, lido do mesmo lugar que o Gerenciador de Tarefas usa. Se você escolher o lado que já está ativo, nada é gravado: não há mudança a fazer.',
  },
  {
    target: '[data-tour="aj-kind"]',
    title: 'E o que é só daquele programa',
    text:
      'A Steam mostra a sua biblioteca, lida da máquina, sem pedir senha nem chave. Cada programa tem a sua seção: extensões no VS Code, linguagens no Visual Studio, conta no Git, navegador padrão nos navegadores, jogos da Riot depois do cliente.',
  },
  {
    target: '[data-tour="aj-voltar"]',
    title: 'Volte para a seleção',
    text:
      'O que você marcou fica guardado no cartão do programa e aparece resumido embaixo do nome dele. Clique aqui para voltar que o passo a passo continua.',
    waitFor: 'grid',
  },
  {
    screen: 2,
    target: '[data-tour="rodape"]',
    title: 'Depois é só mandar',
    text:
      'O rodapé mostra quantos programas, quanto vai baixar e uma estimativa de tempo. A partir daqui a fila cuida do resto.',
  },
  {
    screen: 3,
    target: '[data-tour="3"]',
    title: '3. A fila anda sozinha',
    text:
      'Até três programas ao mesmo tempo, cada um mostrando em qual etapa está: baixar, instalar, ajustar, pronto. Dá para cancelar um sem parar os outros, e para voltar à seleção e acrescentar mais no meio do caminho.',
  },
  {
    target: null,
    title: 'Pode sair de perto',
    text:
      'Se algo falhar ou precisar de você, o Windows avisa com uma notificação e um som, e o ícone na barra de tarefas ganha uma marca: vermelha quando algo falhou, amarela quando a fila está esperando a sua resposta.',
  },
  {
    screen: 4,
    target: '[data-tour="4"]',
    title: '4. O que aconteceu',
    text:
      'O resumo separa o que ficou pronto, o que só termina depois de reiniciar, o que precisa de você e o que ficou de fora, com o motivo de cada um. É daqui que sai o reinício, com contagem e chance de desistir.',
  },
  {
    target: '[data-tour="ajuda"]',
    title: 'Chegamos ao fim',
    text:
      'Este passo a passo abre sozinho na primeira vez. Depois, é por aqui, e ele percorre tudo de novo do começo. O disco escolhido fica guardado; a conta do Git não, ela é lida da sua máquina toda vez que você abre os ajustes.',
  },
]
