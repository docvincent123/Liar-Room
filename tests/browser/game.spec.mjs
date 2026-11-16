import {test,expect} from '@playwright/test';
test('desktop storefront and playable five-round solo match',async({page},testInfo)=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{name:/УСІ МАЮТЬ/})).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('01-home.png'),fullPage:true});
 await page.getByRole('button',{name:'Магазин'}).click();
 await expect(page.getByText('Оплата ще недоступна.',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Приміряти безкоштовно'}).click();
 await expect(page.getByRole('status')).toContainText('безкоштовний перегляд');
 await page.screenshot({path:testInfo.outputPath('02-shop.png'),fullPage:true});
 await page.getByRole('button',{name:'Головна',exact:true}).click();
 await page.getByRole('button',{name:/Спробувати з ботами/}).click();
 await page.getByLabel('Твій нік').fill('Браузерний тест');
 await page.getByRole('button',{name:'Почати тренування →',exact:true}).click();
 await expect(page.getByText('Ти — ведучий. П’ять ботів уже готові.')).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('03-lobby.png'),fullPage:true});
 await page.getByRole('button',{name:'Почати перший раунд →'}).click();
 for(let round=1;round<=5;round++){
  await expect(page.getByText('ЧАС ЗРОБИТИ ВИБІР',{exact:true})).toBeVisible();
  await expect(page.locator('.clue')).toHaveCount(5);
  await expect(page.locator('.secret-card')).toHaveCount(0);
  if(round===1){
   await page.screenshot({path:testInfo.outputPath('04-round.png'),fullPage:true});
   await page.reload();
   await expect(page.locator('.clue')).toHaveCount(5);
  }
  await page.locator('.clue').first().click();
  await page.getByLabel('Твоя відповідь',{exact:true}).fill('Не знаю');
  await page.getByRole('button',{name:'Відповісти й викрити брехуна ↗'}).click();
  await expect(page.getByText('ПРАВИЛЬНА ВІДПОВІДЬ',{exact:true})).toBeVisible();
  if(round<5)await page.getByRole('button',{name:'Наступний раунд →'}).click();
 }
 await expect(page.getByText('МАТЧ ЗАВЕРШЕНО',{exact:true})).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('05-result.png'),fullPage:true});
 await page.getByRole('button',{name:'На головну →'}).click();
 await expect(page.getByRole('heading',{name:/УСІ МАЮТЬ/})).toBeVisible();
});
test('mobile layout, modal keyboard and no horizontal overflow',async({page},testInfo)=>{
 await page.setViewportSize({width:375,height:812});
 await page.goto('/');
 await expect(page.getByRole('heading',{name:/УСІ МАЮТЬ/})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('06-mobile.png'),fullPage:true});
 await page.getByRole('button',{name:'У мене є код',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByLabel('Твій нік').fill('Мобільний');
 await page.waitForTimeout(600);
 await expect(page.getByLabel('Твій нік')).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('3D demo cards flip, pointer tilt resets, and friends seats open an invitation',async({page},testInfo)=>{
 await page.goto('/');
 const card=page.getByRole('button',{name:'Демонстраційна картка Лис',exact:true});
 await expect(card).toHaveAttribute('aria-pressed','false');
 await card.hover();
 await page.mouse.move(10,10);
 await card.click();
 await expect(card).toHaveAttribute('aria-pressed','true');
 await expect(card.locator('.card-identity')).toHaveAttribute('aria-hidden','false');
 await expect(card.locator('.identity-title')).toHaveText('БРЕХУН');
 await expect(card.locator('.card-rotor')).toHaveCSS('transform-style','preserve-3d');
 await page.waitForTimeout(750);
 await page.screenshot({path:testInfo.outputPath('07-flipped-deck.png'),fullPage:true});
 await card.click();
 await expect(card).toHaveAttribute('aria-pressed','false');
 await page.getByRole('button',{name:'Друзі',exact:true}).click();
 await expect(page.locator('.seat-card')).toHaveCount(6);
 await page.screenshot({path:testInfo.outputPath('08-friends.png'),fullPage:true});
 await page.getByRole('button',{name:'Запросити друга на місце 1',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.keyboard.press('Escape');
 await page.setViewportSize({width:375,height:812});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('09-friends-mobile.png'),fullPage:true});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.getByRole('button',{name:'Головна',exact:true}).click();
 await card.click();
 await expect(card).toHaveAttribute('aria-pressed','true');
});

test('human role card flips privately and removes secret text when hidden',async({page},testInfo)=>{
 const {io}=await import('socket.io-client');
 const peers=[];
 async function connectPeer(){
  const peer=io('http://localhost:3000',{transports:['websocket'],forceNew:true,autoConnect:false});
  peers.push(peer);await new Promise((resolve,reject)=>{peer.once('connect',resolve);peer.once('connect_error',reject);peer.connect();});return peer;
 }
 const emit=(peer,event,data)=>peer.timeout(5000).emitWithAck(event,data??{});
 try{
  const host=await connectPeer();
  const created=await emit(host,'room:create',{name:'Ведучий тесту',theme:'mixed'});
  expect(created.ok).toBe(true);
  for(let n=0;n<4;n++){
   const peer=await connectPeer();
   expect((await emit(peer,'room:join',{name:'Друг '+n,code:created.code})).ok).toBe(true);
  }
  await page.goto('/?room='+created.code);
  await page.getByLabel('Твій нік').fill('Гравець браузера');
  await page.getByRole('button',{name:'Приєднатися →',exact:true}).click();
  await expect(page.locator('.seat-card')).toHaveCount(6);
  expect((await emit(host,'round:start')).ok).toBe(true);
  const show=page.getByRole('button',{name:'Показати роль',exact:true});
  await expect(show).toBeVisible();
  await expect(page.locator('.role-front strong')).toHaveCount(0);
  await show.click();
  await expect(page.getByRole('button',{name:'Сховати роль',exact:true})).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('.role-front strong')).toHaveCount(1);
  await page.waitForTimeout(750);
  await page.screenshot({path:testInfo.outputPath('10-private-role.png'),fullPage:true});
  await page.getByRole('button',{name:'Сховати роль',exact:true}).click();
  await expect(page.locator('.role-front strong')).toHaveCount(0);
  await page.getByLabel('Твоя підказка',{exact:true}).fill('Це моя обережна підказка');
  await page.getByRole('button',{name:'Надіслати ↗',exact:true}).click();
  await expect(page.getByText('Твою підказку прийнято:',{exact:false})).toBeVisible();
 }finally{for(const peer of peers)peer.disconnect();}
});
