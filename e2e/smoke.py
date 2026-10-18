import re, time, random
from playwright.sync_api import sync_playwright
import os; S=os.environ.get('SHOTS','shots/'); os.makedirs(S, exist_ok=True)
URL=os.environ.get('URL','http://localhost:5173')
errors=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    host=b.new_context(viewport={'width':1280,'height':900}).new_page()
    guest=b.new_context(viewport={'width':390,'height':844}, is_mobile=True).new_page()
    for pg in (host,guest): pg.on('console', lambda m: m.type=='error' and errors.append(m.text))
    host.goto(URL); host.wait_for_timeout(800); host.screenshot(path=S+'1-home.png', full_page=True)
    # cadastro
    host.goto(URL+'/entrar'); host.get_by_role('tab', name='Criar conta').click()
    email=f'e2e{random.randint(1,10**9)}@x.com'
    host.get_by_label('Apelido').fill('Ana'); host.get_by_label('E-mail').fill(email); host.get_by_label('Senha').fill('senha12345')
    host.get_by_role('button', name='Criar conta').last.click(); host.wait_for_url(URL+'/')
    host.get_by_label('Nome da sala').fill('Festa da Ana')
    host.get_by_role('button', name='Criar e convidar').click()
    host.wait_for_url(re.compile(r'/sala/[A-Z0-9]{6}'), timeout=10000); code=host.url.split('/')[-1]
    # convidado entra pelo link
    guest.goto(f'{URL}/sala/{code}'); guest.get_by_label('Apelido').fill('Bia'); guest.get_by_role('button', name='Jogar como convidado').click()
    guest.get_by_text('Bia (você)').wait_for()
    host.get_by_text('Bia', exact=True).wait_for()
    # anfitrião ajusta: 1 rodada, sem contagem pós-stop
    host.get_by_label('Rodadas').select_option('1'); host.get_by_label('Após STOP (s)').select_option('0'); host.wait_for_timeout(300)
    guest.locator('#chat-input').fill('oi gente!'); guest.get_by_role('button', name='Enviar').click()
    host.get_by_text('oi gente!').wait_for()
    host.screenshot(path=S+'2-lobby-host.png', full_page=True); guest.screenshot(path=S+'3-lobby-guest-mobile.png', full_page=True)
    assert guest.get_by_role('button', name='Começar partida').count()==0
    host.get_by_role('button', name='Começar partida').click()
    letter=host.get_by_label(re.compile(r'^Letra [A-Z]$')).inner_text().strip()
    cats=['Nome','Animal','Cidade','Comida','Objeto','Profissão']
    for c in cats: host.get_by_label(c, exact=True).fill(letter+'aaa'+c.lower())
    for c in cats[:3]: guest.get_by_label(c, exact=True).fill(letter+'bbb')
    guest.get_by_label('Comida', exact=True).fill('Zzz')
    host.wait_for_timeout(600); host.screenshot(path=S+'4-answering.png', full_page=True)
    host.get_by_role('button', name='STOP!').click()
    guest.get_by_text('Hora de conferir').wait_for()
    # Bia contesta a Cidade da Ana
    guest.get_by_role('button', name=letter+'aaacidade').click(); guest.wait_for_timeout(400)
    guest.screenshot(path=S+'5-review-mobile.png', full_page=True)
    host.get_by_role('button', name='Terminei de conferir').click(); guest.get_by_role('button', name='Terminei de conferir').click()
    host.get_by_text('Resultado da rodada').wait_for(); host.screenshot(path=S+'6-round-results.png', full_page=True)
    host.get_by_role('button', name='Próxima rodada').click(); guest.get_by_role('button', name='Próxima rodada').click()
    host.get_by_text('Fim de jogo!').wait_for(); host.wait_for_timeout(500)
    host.screenshot(path=S+'7-final.png', full_page=True); guest.screenshot(path=S+'8-final-mobile.png', full_page=True)
    rank=host.locator('#results-title').locator('..').locator('..').locator('ol li').all_inner_texts()
    print('RANKING', rank)
    # reconexão: guest recarrega a página
    guest.reload(); guest.get_by_text('Fim de jogo!').wait_for(); print('reconexão OK')
    # perfil com histórico
    host.goto(URL+'/perfil'); host.get_by_text('Festa').count(); host.wait_for_timeout(800)
    host.screenshot(path=S+'9-profile.png', full_page=True)
    print('historico:', host.locator('#hist-title').locator('..').inner_text()[:200].replace('\n',' | '))
    host.goto(URL+'/nada'); host.screenshot(path=S+'10-404.png')
    b.close()
print('console errors:', errors)
