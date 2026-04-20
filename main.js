import { initializeApp }                            from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut, updateProfile
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, collection, doc,
  getDoc, getDocs, setDoc, updateDoc,
  addDoc, deleteDoc, onSnapshot,
  writeBatch, serverTimestamp,
  enableIndexedDbPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
 
// ── CONFIG FIREBASE ───────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyCR-_gi_2InOeiv_2lnZByD2QwZg3Wmgo4',
  authDomain:        'restaurante-os.firebaseapp.com',
  projectId:         'restaurante-os',
  storageBucket:     'restaurante-os.firebasestorage.app',
  messagingSenderId: '374170112531',
  appId:             '1:374170112531:web:a78ca2e7400cb837f9e5e6',
};
const fbApp = initializeApp(firebaseConfig);
const auth  = getAuth(fbApp);
const db    = getFirestore(fbApp);
 
// ── OFFLINE PERSISTENCE (dados disponíveis mesmo sem internet) ────
enableIndexedDbPersistence(db).catch(e=>{
  if(e.code==='failed-precondition') console.warn('Offline: múltiplas abas abertas');
  else if(e.code==='unimplemented')  console.warn('Offline: browser não suportado');
});
 
// ── HELPERS FIRESTORE ─────────────────────────────────────────────
const col  = (c)    => collection(db, c);
const ref  = (c,id) => doc(db, c, id);
async function fsSet(c,id,data) { await setDoc(ref(c,id),data); }
async function fsUpd(c,id,data) { try{ await updateDoc(ref(c,id),data); }catch{ await setDoc(ref(c,id),data); } }
async function fsDel(c,id)      { await deleteDoc(ref(c,id)); }
async function fsAdd(c,data)    { const r=await addDoc(col(c),data); return r.id; }
async function fsGet(c,id)      { const s=await getDoc(ref(c,id)); return s.exists()?{id:s.id,...s.data()}:null; }
async function fsAll(c)         { const s=await getDocs(col(c)); return s.docs.map(d=>({id:d.id,...d.data()})); }
 
// ── CONFIG SISTEMA ────────────────────────────────────────────────
const SYS = { taxaServico:10, nMesas:15, nomeRestaurante:'RestaurantOS', alertaEstoque:0.25, autoRefreshMs:8000 };
 
// ── ROLE CONFIG ───────────────────────────────────────────────────
const ROLE_CONFIG = {
  garcom:     {label:'Garçom',     color:'#1e40af',bg:'#eff6ff', pages:['mesas','pedido','cozinha'],                                                                    canOrder:true,  canKDS:true,  canCaixa:false,canRelatorio:false,canConfig:false,canCardapio:false},
  cozinheiro: {label:'Cozinheiro', color:'#92400e',bg:'#fff7ed', pages:['cozinha'],                                                                                     canOrder:false, canKDS:true,  canCaixa:false,canRelatorio:false,canConfig:false,canCardapio:false},
  caixa:      {label:'Caixa',      color:'#065f46',bg:'#ecfdf5', pages:['mesas','caixa'],                                                                               canOrder:false, canKDS:false, canCaixa:true, canRelatorio:false,canConfig:false,canCardapio:false},
  gerente:    {label:'Gerente',    color:'#4c1d95',bg:'#f5f3ff', pages:['mesas','pedido','cozinha','caixa','estoque','cardapio','relatorios','relatorios-mensais','config'], canOrder:true,  canKDS:true,  canCaixa:true, canRelatorio:true, canConfig:true, canCardapio:true},
};
 
// ── CARDÁPIO PADRÃO ───────────────────────────────────────────────
const CARDAPIO_PADRAO = [
  {id:'1',nome:'Filé ao molho madeira',cat:'Pratos',preco:54.90,tempo:20,icon:'🥩',ing:'{"carne":1,"molho":0.5}',ativo:1},
  {id:'2',nome:'Frango grelhado',cat:'Pratos',preco:38.90,tempo:15,icon:'🍗',ing:'{"frango":1}',ativo:1},
  {id:'3',nome:'Salmão ao forno',cat:'Pratos',preco:72.90,tempo:22,icon:'🐟',ing:'{"peixe":1,"azeite":0.2}',ativo:1},
  {id:'4',nome:'Macarrão carbonara',cat:'Pratos',preco:44.90,tempo:18,icon:'🍝',ing:'{"massa":0.3,"ovos":0.5}',ativo:1},
  {id:'5',nome:'Costela no bafo',cat:'Pratos',preco:89.90,tempo:35,icon:'🍖',ing:'{"carne":1.5}',ativo:1},
  {id:'6',nome:'Pizza Margherita',cat:'Pizzas',preco:48.90,tempo:25,icon:'🍕',ing:'{"farinha":0.5,"molho":0.3}',ativo:1},
  {id:'7',nome:'Pizza Calabresa',cat:'Pizzas',preco:52.90,tempo:25,icon:'🍕',ing:'{"farinha":0.5,"molho":0.3}',ativo:1},
  {id:'8',nome:'Pizza Quatro Queijos',cat:'Pizzas',preco:58.90,tempo:25,icon:'🍕',ing:'{"farinha":0.5}',ativo:1},
  {id:'9',nome:'Camarão alho e óleo',cat:'Frutos do Mar',preco:79.90,tempo:20,icon:'🦐',ing:'{"camarao":0.4,"azeite":0.1}',ativo:1},
  {id:'10',nome:'Salada Caesar',cat:'Entradas',preco:28.90,tempo:8,icon:'🥗',ing:'{}',ativo:1},
  {id:'11',nome:'Bruschetta',cat:'Entradas',preco:22.90,tempo:10,icon:'🫓',ing:'{"pao":0.2}',ativo:1},
  {id:'12',nome:'Sopa do dia',cat:'Entradas',preco:18.90,tempo:5,icon:'🥣',ing:'{}',ativo:1},
  {id:'13',nome:'Refrigerante Lata',cat:'Bebidas',preco:8.90,tempo:1,icon:'🥤',ing:'{}',ativo:1},
  {id:'14',nome:'Suco natural',cat:'Bebidas',preco:14.90,tempo:5,icon:'🍊',ing:'{}',ativo:1},
  {id:'15',nome:'Água mineral',cat:'Bebidas',preco:5.90,tempo:1,icon:'💧',ing:'{}',ativo:1},
  {id:'16',nome:'Vinho tinto (taça)',cat:'Bebidas',preco:24.90,tempo:2,icon:'🍷',ing:'{}',ativo:1},
  {id:'17',nome:'Cerveja artesanal',cat:'Bebidas',preco:19.90,tempo:2,icon:'🍺',ing:'{}',ativo:1},
  {id:'18',nome:'Pudim de leite',cat:'Sobremesas',preco:16.90,tempo:3,icon:'🍮',ing:'{}',ativo:1},
  {id:'19',nome:'Petit gateau',cat:'Sobremesas',preco:26.90,tempo:8,icon:'🍫',ing:'{"ovos":0.3}',ativo:1},
  {id:'20',nome:'Sorvete 3 bolas',cat:'Sobremesas',preco:18.90,tempo:3,icon:'🍨',ing:'{}',ativo:1},
];
 
const ESTOQUE_PADRAO = {
  carne:   {nome:'Carne bovina',icon:'🥩',qty:12,max_qty:25,unidade:'kg'},
  frango:  {nome:'Frango',icon:'🍗',qty:8,max_qty:18,unidade:'kg'},
  peixe:   {nome:'Salmão',icon:'🐟',qty:4,max_qty:12,unidade:'kg'},
  camarao: {nome:'Camarão',icon:'🦐',qty:3,max_qty:10,unidade:'kg'},
  massa:   {nome:'Massa',icon:'🍝',qty:15,max_qty:25,unidade:'kg'},
  farinha: {nome:'Farinha',icon:'🌾',qty:20,max_qty:35,unidade:'kg'},
  molho:   {nome:'Molho tomate',icon:'🍅',qty:10,max_qty:22,unidade:'L'},
  ovos:    {nome:'Ovos',icon:'🥚',qty:30,max_qty:72,unidade:'un'},
  azeite:  {nome:'Azeite',icon:'🫒',qty:5,max_qty:12,unidade:'L'},
  pao:     {nome:'Pão',icon:'🍞',qty:20,max_qty:40,unidade:'un'},
};
 
// ── ESTADO GLOBAL ─────────────────────────────────────────────────
const STATE = {
  currentUser:null, dbReady:false, mesaSel:null, cartItems:[],
  caixaMesa:null, pgtoSel:null, removerTaxa:false,
  deselectMesaId:null, kdsFilter:'todos', relPeriod:'hoje',
  cardapioCatFiltro:'Todos', adminCatFiltro:'Todos',
  mesMensalAberto:null, usuarioEditRole:'garcom',
};
 
// ── CACHE LOCAL ───────────────────────────────────────────────────
const DB = {
  mesas:{}, cardapio:{}, pedidos:{}, pedido_itens:{},
  estoque:{}, config:{}, relatorio_dia:{}, fat_hora:{},
  ranking_itens:{}, fat_pgto:{}, fat_cat:{}, usuarios:{},
  contas_fechadas:{}, relatorios_mensais:{},
};
 
// ── LOG ───────────────────────────────────────────────────────────
function sysLog(msg, type='msg') {
  const panel = document.getElementById('log-panel');
  if (!panel) return;
  const now = new Date();
  const ts  = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  const div = document.createElement('div');
  div.className = 'log-line';
  const cls = type==='err'?'log-err':type==='info'?'log-info':'log-msg';
  div.innerHTML = `<span class="log-ts">${ts}</span><span class="${cls}">${msg}</span>`;
  panel.appendChild(div);
  panel.scrollTop = panel.scrollHeight;
  while(panel.children.length>60) panel.removeChild(panel.firstChild);
}
window.clearLog = () => { document.getElementById('log-panel').innerHTML = ''; };
 
// ── UTILITÁRIOS ───────────────────────────────────────────────────
function todayStr() { const d=new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }
function tStr(ms)   { const m=Math.floor(ms/60000); return m<60?`${m}min`:`${Math.floor(m/60)}h${String(m%60).padStart(2,'0')}`; }
function fmtBRL(v)  { return 'R$ '+Number(v||0).toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.'); }
function uuid()     { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&0x3|0x8)).toString(16);}); }
 
// ════════════════════════════════════════════════
// AUTENTICAÇÃO
// ════════════════════════════════════════════════
function showLoginErr(msg)    { const e=document.getElementById('login-err'); e.textContent=msg; e.classList.add('show'); }
function hideLoginErr()       { document.getElementById('login-err').classList.remove('show'); }
function setLoginLoading(b)   { document.getElementById('login-loading').classList.toggle('show',b); }
 
window.abrirCadastro = () => openModal('modal-cadastro');
 
// FIX: Cadastro agora abre modal inline em vez de redirecionar para cadastro.html
window.doCadastro = async () => {
  const nome  = document.getElementById('cad-nome').value.trim();
  const email = document.getElementById('cad-email').value.trim();
  const senha = document.getElementById('cad-senha').value;
  const err   = document.getElementById('cad-err');
  const load  = document.getElementById('cad-loading');
  err.classList.remove('show');
  if (!nome||!email||!senha) { err.textContent='Preencha todos os campos.'; err.classList.add('show'); return; }
  if (senha.length<6)        { err.textContent='Senha mínimo 6 caracteres.'; err.classList.add('show'); return; }
  load.classList.add('show');
  try {
    const uc = await createUserWithEmailAndPassword(auth, email, senha);
    await updateProfile(uc.user, {displayName: nome});
    await fsSet('usuarios', uc.user.uid, {nome, email, role:'garcom', ativo:true, criadoEm:new Date().toISOString()});
    load.classList.remove('show');
    closeModal('modal-cadastro');
    toast('Conta criada! Bem-vindo(a)!','success');
  } catch(e) {
    load.classList.remove('show');
    const msgs={'auth/email-already-in-use':'E-mail já cadastrado.','auth/weak-password':'Senha muito fraca.'};
    err.textContent = msgs[e.code]||`Erro: ${e.message}`;
    err.classList.add('show');
  }
};
 
// FIX: Recuperação de senha agora usa Firebase sendPasswordResetEmail
window.abrirRecuperarSenha = (e) => { e.preventDefault(); openModal('modal-recuperar-senha'); };
window.enviarResetSenha = async () => {
  const email = document.getElementById('reset-email').value.trim();
  const err   = document.getElementById('reset-err');
  const load  = document.getElementById('reset-loading');
  err.classList.remove('show');
  if (!email) { err.textContent='Informe o e-mail.'; err.classList.add('show'); return; }
  load.classList.add('show');
  try {
    await sendPasswordResetEmail(auth, email);
    load.classList.remove('show');
    closeModal('modal-recuperar-senha');
    toast('Link enviado! Verifique seu e-mail.','success');
  } catch(e) {
    load.classList.remove('show');
    const msgs={'auth/user-not-found':'E-mail não encontrado.','auth/invalid-email':'E-mail inválido.'};
    err.textContent = msgs[e.code]||`Erro: ${e.message}`;
    err.classList.add('show');
  }
};
 
window.doEmailLogin = async () => {
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  if (!email||!senha) { showLoginErr('Preencha e-mail e senha.'); return; }
  hideLoginErr(); setLoginLoading(true);
  try {
    await signInWithEmailAndPassword(auth, email, senha);
  } catch(e) {
    setLoginLoading(false);
    const msgs = {'auth/user-not-found':'Usuário não encontrado.','auth/wrong-password':'Senha incorreta.','auth/invalid-email':'E-mail inválido.','auth/invalid-credential':'E-mail ou senha inválidos.','auth/too-many-requests':'Muitas tentativas. Aguarde.'};
    showLoginErr(msgs[e.code]||`Erro: ${e.message}`);
  }
};
 
window.doLogout = async () => {
  if (!confirm('Deseja sair do sistema?')) return;
  await signOut(auth);
  document.getElementById('app').style.display='none';
  document.getElementById('login-screen').classList.remove('hidden');
  STATE.currentUser=null; STATE.dbReady=false;
  sysLog('Sessão encerrada');
};
 
onAuthStateChanged(auth, async (firebaseUser) => {
  setLoginLoading(false);
  if (!firebaseUser) {
    document.getElementById('app').style.display='none';
    document.getElementById('login-screen').classList.remove('hidden');
    STATE.dbReady=false; return;
  }
  try {
    let perfil = await fsGet('usuarios', firebaseUser.uid);
    if (!perfil) {
      const defaultNome = firebaseUser.displayName||firebaseUser.email.split('@')[0];
      perfil = {uid:firebaseUser.uid, nome:defaultNome, role:'garcom', email:firebaseUser.email};
      await fsSet('usuarios', firebaseUser.uid, {nome:perfil.nome, role:perfil.role, email:perfil.email, ativo:true, criadoEm:new Date().toISOString()});
    }
    STATE.currentUser = {uid:firebaseUser.uid, email:firebaseUser.email, nome:perfil.nome, role:perfil.role};
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').style.display='flex';
    aplicarRole(STATE.currentUser.role);
    sysLog(`Login: ${STATE.currentUser.nome} (${STATE.currentUser.role}) — ${STATE.currentUser.email}`,'info');
    await initDB();
    if (STATE.currentUser.role==='cozinheiro') goPage('cozinha');
  } catch(e) {
    showLoginErr('Erro ao carregar perfil: '+e.message);
    await signOut(auth);
  }
});
 
function aplicarRole(role) {
  const rc = ROLE_CONFIG[role]||ROLE_CONFIG.garcom;
  const u  = STATE.currentUser;
  const av = document.getElementById('user-avatar');
  av.textContent = (u.nome||'?').charAt(0).toUpperCase();
  av.style.background = rc.color;
  document.getElementById('user-name').textContent = u.nome;
  const rb = document.getElementById('user-role-badge');
  rb.textContent = rc.label; rb.style.background=rc.bg; rb.style.color=rc.color;
  document.getElementById('nav-cardapio').style.display         = rc.canCardapio  ?'':'none';
  document.getElementById('nav-relatorios').style.display       = rc.canRelatorio ?'':'none';
  document.getElementById('nav-relatorios-mensais').style.display = rc.canRelatorio?'':'none';
  document.getElementById('nav-config').style.display           = rc.canConfig    ?'':'none';
  // FIX: Config também aparece no mobile para gerente
  const mobCfg = document.getElementById('nav-mob-config');
  if (mobCfg) mobCfg.style.display = rc.canConfig ? '' : 'none';
}
 
// ════════════════════════════════════════════════
// BANCO DE DADOS — INICIALIZAÇÃO
// ════════════════════════════════════════════════
async function initDB() {
  sysLog('Conectando ao Firestore...','info');
  try {
    const [mesasD,cardapioD,pedidosD,itensD,estoqueD,configD,relD,fatHD,rankD,fatPD,fatCD,usersD,contasD,relMensaisD] = await Promise.all([
      fsAll('mesas'),fsAll('cardapio'),fsAll('pedidos'),fsAll('pedido_itens'),
      fsAll('estoque'),fsAll('config'),fsAll('relatorio_dia'),fsAll('fat_hora'),
      fsAll('ranking_itens'),fsAll('fat_pgto'),fsAll('fat_cat'),fsAll('usuarios'),
      fsAll('contas_fechadas'),fsAll('relatorios_mensais'),
    ]);
    mesasD.forEach(d       => { DB.mesas[d.id]             = d; });
    cardapioD.forEach(d    => { DB.cardapio[d.id]          = d; });
    pedidosD.forEach(d     => { DB.pedidos[d.id]           = d; });
    itensD.forEach(d       => { DB.pedido_itens[d.id]      = d; });
    estoqueD.forEach(d     => { DB.estoque[d.id]           = d; });
    configD.forEach(d      => { DB.config[d.id]            = d.valor; });
    relD.forEach(d         => { DB.relatorio_dia[d.id]     = d; });
    fatHD.forEach(d        => { DB.fat_hora[d.id]          = d; });
    rankD.forEach(d        => { DB.ranking_itens[d.id]     = d; });
    fatPD.forEach(d        => { DB.fat_pgto[d.id]          = d; });
    fatCD.forEach(d        => { DB.fat_cat[d.id]           = d; });
    usersD.forEach(d       => { DB.usuarios[d.id]          = d; });
    contasD.forEach(d      => { DB.contas_fechadas[d.id]   = d; });
    relMensaisD.forEach(d  => { DB.relatorios_mensais[d.id]= d; });
    sysLog(`Firestore: ${mesasD.length} mesas, ${cardapioD.length} itens, ${pedidosD.length} pedidos`,'info');
    await ensureInitialData();
    loadConfig();
    setupRealtimeListeners();
    STATE.dbReady=true;
    await checkNightReset();
    renderAll();
    sysLog('Sistema pronto ✓','info');
  } catch(e) {
    sysLog('ERRO Firestore: '+e.message,'err');
    console.error(e);
    toast('Erro ao conectar ao Firestore','error');
  }
}
 
async function ensureInitialData() {
  const hoje = todayStr();
  if (!Object.keys(DB.mesas).length) {
    for (let i=1;i<=SYS.nMesas;i++) {
      const m={status:'livre',capacidade:4,inicio:null,total:0};
      await fsSet('mesas',String(i),m);
      DB.mesas[String(i)]={id:String(i),...m};
    }
    sysLog(`${SYS.nMesas} mesas criadas`,'info');
  }
  if (!Object.keys(DB.cardapio).length) {
    for (const it of CARDAPIO_PADRAO) {
      await fsSet('cardapio',it.id,{nome:it.nome,cat:it.cat,preco:it.preco,tempo:it.tempo,icon:it.icon,ing:it.ing,ativo:it.ativo});
      DB.cardapio[it.id]={id:it.id,...it};
    }
    sysLog(`${CARDAPIO_PADRAO.length} itens inseridos`,'info');
  }
  if (!Object.keys(DB.estoque).length) {
    for (const [k,v] of Object.entries(ESTOQUE_PADRAO)) {
      await fsSet('estoque',k,v);
      DB.estoque[k]={id:k,...v};
    }
  }
  if (!DB.relatorio_dia[hoje]) {
    const rd={pedidos_total:0,faturamento:0,itens_total:0};
    await fsSet('relatorio_dia',hoje,rd);
    DB.relatorio_dia[hoje]={id:hoje,data:hoje,...rd};
  }
}
 
function loadConfig() {
  if (DB.config['taxa_servico']!==undefined) SYS.taxaServico=parseFloat(DB.config['taxa_servico']);
  if (DB.config['nome_restaurante'])          SYS.nomeRestaurante=DB.config['nome_restaurante'];
  if (DB.config['n_mesas'])                  SYS.nMesas=parseInt(DB.config['n_mesas']);
}
 
function setupRealtimeListeners() {
  onSnapshot(col('mesas'), snap => {
    snap.docChanges().forEach(ch => {
      if(ch.type==='removed') delete DB.mesas[ch.doc.id];
      else DB.mesas[ch.doc.id]={id:ch.doc.id,...ch.doc.data()};
    });
    if(STATE.dbReady){
      if(document.getElementById('page-mesas').classList.contains('active'))  renderFloor();
      if(document.getElementById('page-caixa').classList.contains('active'))  renderCaixa();
    }
  });
  onSnapshot(col('relatorio_dia'), snap => { snap.docChanges().forEach(ch => { DB.relatorio_dia[ch.doc.id]={data:ch.doc.id,...ch.doc.data()}; }); });
  onSnapshot(col('fat_hora'),      snap => { snap.docChanges().forEach(ch => { DB.fat_hora[ch.doc.id]={id:ch.doc.id,...ch.doc.data()}; }); });
  onSnapshot(col('ranking_itens'), snap => { snap.docChanges().forEach(ch => { DB.ranking_itens[ch.doc.id]={id:ch.doc.id,...ch.doc.data()}; }); });
  onSnapshot(col('fat_pgto'),      snap => { snap.docChanges().forEach(ch => { DB.fat_pgto[ch.doc.id]={id:ch.doc.id,...ch.doc.data()}; }); });
  onSnapshot(col('fat_cat'),       snap => { snap.docChanges().forEach(ch => { DB.fat_cat[ch.doc.id]={id:ch.doc.id,...ch.doc.data()}; }); });
  onSnapshot(col('pedidos'), snap => {
    let temNovo=false;
    snap.docChanges().forEach(ch => {
      if(ch.type==='removed') delete DB.pedidos[ch.doc.id];
      else {
        const novo={id:ch.doc.id,...ch.doc.data()};
        if(ch.type==='added'&&novo.status==='preparo') temNovo=true;
        DB.pedidos[ch.doc.id]=novo;
      }
    });
    if(STATE.dbReady){
      if(temNovo) tocarAlertaKDS();
      if(document.getElementById('page-cozinha').classList.contains('active')) renderKDS();
      if(document.getElementById('page-mesas').classList.contains('active'))  renderFloor();
      if(document.getElementById('page-caixa').classList.contains('active'))  renderCaixa();
    }
  });
  onSnapshot(col('pedido_itens'), snap => {
    snap.docChanges().forEach(ch => {
      if(ch.type==='removed') delete DB.pedido_itens[ch.doc.id];
      else DB.pedido_itens[ch.doc.id]={id:ch.doc.id,...ch.doc.data()};
    });
  });
  onSnapshot(col('contas_fechadas'), snap => {
    snap.docChanges().forEach(ch => {
      if(ch.type==='removed') delete DB.contas_fechadas[ch.doc.id];
      else DB.contas_fechadas[ch.doc.id]={id:ch.doc.id,...ch.doc.data()};
    });
  });
  onSnapshot(col('relatorios_mensais'), snap => {
    snap.docChanges().forEach(ch => {
      if(ch.type==='removed') delete DB.relatorios_mensais[ch.doc.id];
      else DB.relatorios_mensais[ch.doc.id]={id:ch.doc.id,...ch.doc.data()};
    });
    if(STATE.dbReady&&document.getElementById('page-relatorios-mensais').classList.contains('active')) renderRelatoriosMensais();
  });
}
 
// ════════════════════════════════════════════════
// RESET NOTURNO
// ════════════════════════════════════════════════
async function checkNightReset() {
  if(!STATE.dbReady) return;
  const now=new Date(), hoje=todayStr(), last=DB.config['last_reset']||'';
  if(now.getHours()>=2&&last!==hoje) await doNightReset(hoje);
  await checkFecharMesAnterior();
}
 
async function doNightReset(hoje) {
  sysLog('Executando reset noturno...','info');
  const batch=writeBatch(db);
  Object.entries(DB.mesas).forEach(([id,m])=>{
    if(m.status!=='livre'){batch.update(ref('mesas',id),{status:'livre',inicio:null,total:0});DB.mesas[id]={...m,status:'livre',inicio:null,total:0};}
  });
  Object.entries(DB.pedidos).forEach(([id,p])=>{
    if(p.status==='preparo'||p.status==='pronto'){batch.update(ref('pedidos',id),{status:'entregue'});DB.pedidos[id]={...p,status:'entregue'};}
  });
  batch.set(ref('config','last_reset'),{valor:hoje});
  await batch.commit();
  DB.config['last_reset']=hoje;
  if(!DB.relatorio_dia[hoje]){const rd={pedidos_total:0,faturamento:0,itens_total:0};await fsSet('relatorio_dia',hoje,rd);DB.relatorio_dia[hoje]={id:hoje,data:hoje,...rd};}
  sysLog('Reset noturno concluído — '+hoje,'info');
  const b=document.getElementById('night-banner');
  b.style.display='flex'; setTimeout(()=>b.style.display='none',9000);
}
 
// ════════════════════════════════════════════════
// MESAS
// ════════════════════════════════════════════════
function renderFloor() {
  if(!STATE.dbReady) return;
  const mesas=Object.values(DB.mesas).sort((a,b)=>parseInt(a.id)-parseInt(b.id));
  const g=document.getElementById('floor-grid');
  g.innerHTML=mesas.map(m=>{
    const elapsed=m.inicio?tStr(Date.now()-m.inicio):'';
    const ativos=m.status!=='livre'?Object.values(DB.pedidos).filter(p=>p.mesa_id===m.id&&(p.status==='preparo'||p.status==='pronto')).length:0;
    return `<div class="mesa-wrap">
      <button class="mesa ${m.status}" onclick="clickMesa('${m.id}')">
        <div class="mesa-num">${m.id}</div>
        <div class="mesa-sub">${m.status==='livre'?'Livre':m.status==='ocupada'?'Ocupada':'Conta'}</div>
        ${elapsed?`<div class="mesa-timer">${elapsed}</div>`:''}
        ${ativos>0?`<div style="font-size:9px;color:var(--amber-m);font-weight:700;margin-top:1px;">${ativos} ped.</div>`:''}
      </button>
      ${m.status!=='livre'?`<button class="mesa-deselect" onclick="pedirDeselect('${m.id}')">✕</button>`:''}
    </div>`;
  }).join('');
  const livres=mesas.filter(m=>m.status==='livre').length;
  const ocup=mesas.filter(m=>m.status!=='livre').length;
  const rel=DB.relatorio_dia[todayStr()]||{};
  document.getElementById('floor-sub').textContent=`${livres} livres · ${ocup} ocupadas`;
  document.getElementById('floor-stats').innerHTML=`
    <div class="metric-card"><div class="metric-val" style="color:var(--green)">${livres}</div><div class="metric-label">Livres</div></div>
    <div class="metric-card"><div class="metric-val" style="color:var(--amber)">${ocup}</div><div class="metric-label">Ocupadas</div></div>
    <div class="metric-card"><div class="metric-val">${rel.pedidos_total||0}</div><div class="metric-label">Pedidos hoje</div></div>
    <div class="metric-card"><div class="metric-val" style="font-size:18px;">${fmtBRL(rel.faturamento||0)}</div><div class="metric-label">Faturamento</div></div>
  `;
}
 
window.clickMesa = async (id) => {
  const m=DB.mesas[id], rc=ROLE_CONFIG[STATE.currentUser?.role]||{};
  if(STATE.currentUser?.role==='caixa'){STATE.caixaMesa=id; goPage('caixa'); return;}
  if(m.status==='livre'){
    if(!rc.canOrder){toast('Sem permissão para abrir mesas','error');return;}
    const upd={status:'ocupada',inicio:Date.now()};
    await fsUpd('mesas',id,upd);
    DB.mesas[id]={...m,...upd};
    sysLog(`Mesa ${id} aberta por ${STATE.currentUser?.nome}`);
    renderFloor();
  }
  STATE.mesaSel=id;
  goPage(rc.canOrder?'pedido':'cozinha');
};
 
window.pedirDeselect = (id) => {
  STATE.deselectMesaId=id;
  const m=DB.mesas[id];
  const pend=Object.values(DB.pedidos).filter(p=>p.mesa_id===id&&p.status!=='entregue'&&p.status!=='cancelado').length;
  document.getElementById('modal-deselect-body').textContent=`Mesa ${id} (${m?.status})${pend>0?` — ${pend} pedido(s) em aberto.`:'.'} Pedidos pendentes serão cancelados. Continuar?`;
  openModal('modal-deselect');
};
 
window.confirmarDeselect = async () => {
  const id=STATE.deselectMesaId; if(!id) return;
  const batch=writeBatch(db);
  Object.entries(DB.pedidos).forEach(([pid,p])=>{
    if(p.mesa_id===id&&(p.status==='preparo'||p.status==='pronto')){
      batch.update(ref('pedidos',pid),{status:'cancelado'});
      DB.pedidos[pid]={...p,status:'cancelado'};
    }
  });
  batch.update(ref('mesas',id),{status:'livre',inicio:null,total:0});
  await batch.commit();
  DB.mesas[id]={...DB.mesas[id],status:'livre',inicio:null,total:0};
  sysLog(`Mesa ${id} liberada`);
  closeModal('modal-deselect');
  STATE.deselectMesaId=null;
  renderFloor(); renderKDS(); renderCaixa();
  toast(`Mesa ${id} liberada`,'success');
};
 
window.confirmarAddMesa = async () => {
  const num=parseInt(document.getElementById('new-mesa-num').value);
  const cap=parseInt(document.getElementById('new-mesa-cap').value)||4;
  if(!num||num<1){toast('Número inválido','error');return;}
  if(DB.mesas[String(num)]){toast(`Mesa ${num} já existe`,'error');return;}
  const m={status:'livre',capacidade:cap,inicio:null,total:0};
  await fsSet('mesas',String(num),m);
  DB.mesas[String(num)]={id:String(num),...m};
  closeModal('modal-add-mesa');
  renderFloor();
  toast(`Mesa ${num} adicionada!`,'success');
};
 
// ════════════════════════════════════════════════
// PEDIDO
// ════════════════════════════════════════════════
function renderMesaSelector() {
  const mesas=Object.values(DB.mesas).sort((a,b)=>parseInt(a.id)-parseInt(b.id));
  document.getElementById('mesa-sel-grid').innerHTML=mesas.map(m=>`
    <button class="mesa-sel-btn ${m.status} ${STATE.mesaSel===m.id||STATE.mesaSel===String(m.id)?'sel':''}" onclick="selMesa('${m.id}')">${m.id}</button>`).join('');
}
 
window.selMesa = async (id) => {
  const m=DB.mesas[id];
  if(m.status==='livre'){
    const upd={status:'ocupada',inicio:Date.now()};
    await fsUpd('mesas',id,upd);
    DB.mesas[id]={...m,...upd};
    renderFloor();
  }
  STATE.mesaSel=id;
  document.getElementById('ped-mesa-lbl').textContent=`Mesa ${id} selecionada`;
  renderMesaSelector();
};
 
function renderCardapio() {
  const cat=STATE.cardapioCatFiltro;
  const itens=Object.values(DB.cardapio).sort((a,b)=>(a.cat+a.nome).localeCompare(b.cat+b.nome));
  const cats=['Todos',...new Set(itens.map(i=>i.cat))];
  document.getElementById('cat-bar').innerHTML=cats.map(c=>`<button class="cat-chip ${c===cat?'active':''}" onclick="filtCardapio('${c}')">${c}</button>`).join('');
  const filtered=cat==='Todos'?itens:itens.filter(i=>i.cat===cat);
  document.getElementById('cardapio-grid').innerHTML=filtered.map(i=>{
    const ing=JSON.parse(i.ing||'{}');
    const sem=Object.entries(ing).some(([k,v])=>{const e=DB.estoque[k];return e&&e.qty<v;});
    const dis=!i.ativo||sem;
    const cartQty=(STATE.cartItems.find(c=>c.id===String(i.id))?.qty)||0;
    return `<button class="item-card" onclick="${dis?'':'addItem('+i.id+')'}" ${dis?'disabled':''}>
      <div class="item-icon-wrap">${i.icon||'🍽️'}</div>
      <div class="item-info">
        <div class="item-cat">${i.cat}</div>
        <div class="item-name">${i.nome}</div>
        <div class="item-price">${fmtBRL(i.preco)}${i.tempo?` <span style="font-size:10px;color:var(--text3);font-weight:400;">· ${i.tempo}min</span>`:''}${sem?` <span style="font-size:10px;color:var(--red);">Esgotado</span>`:''}</div>
      </div>
      ${!dis?`<div class="item-add-btn" role="button">+${cartQty>0?` <span style="font-size:10px;">(${cartQty})</span>`:''}</div>`:''}
    </button>`;
  }).join('');
}
 
window.filtCardapio = (cat) => { STATE.cardapioCatFiltro=cat; renderCardapio(); };
 
window.addItem = (id) => {
  const item=DB.cardapio[String(id)]; if(!item) return;
  const ing=JSON.parse(item.ing||'{}');
  const ex=STATE.cartItems.find(c=>c.id===String(id));
  if(ex) ex.qty++;
  else STATE.cartItems.push({id:String(id),nome:item.nome,preco:item.preco,cat:item.cat,ing,qty:1});
  renderCart();
};
 
window.removeItem = (id) => {
  const ex=STATE.cartItems.find(c=>c.id===String(id)); if(!ex) return;
  if(ex.qty>1) ex.qty--;
  else STATE.cartItems=STATE.cartItems.filter(c=>c.id!==String(id));
  renderCart();
};
 
// ── COMANDA MOBILE: toggle expandir/colapsar ──────────────────────
window.toggleComanda = () => {
  const p = document.getElementById('comanda-panel');
  if(p) p.classList.toggle('expandida');
};
function syncComandaHandle() {
  const total = STATE.cartItems.reduce((s,c)=>s+c.preco*c.qty, 0);
  const count = STATE.cartItems.reduce((s,c)=>s+c.qty, 0);
  const hTotal = document.getElementById('comanda-handle-total');
  const hCount = document.getElementById('comanda-count');
  if(hTotal) hTotal.textContent = fmtBRL(total);
  if(hCount) hCount.textContent = String(count);
  // Se adicionou item, abre a comanda automaticamente
  if(count > 0) {
    const p = document.getElementById('comanda-panel');
    if(p && window.innerWidth < 900) p.classList.add('expandida');
  }
}
 
function renderCart() {
  const el=document.getElementById('cart-items');
  if(!STATE.cartItems.length){
    el.innerHTML='<div class="text-center text-muted" style="padding:20px 0;font-size:13px;">Nenhum item</div>';
    document.getElementById('cart-total').textContent='R$ 0,00';
    syncComandaHandle();
    return;
  }
  el.innerHTML=STATE.cartItems.map(c=>`
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${c.nome}</div>
        <div class="cart-item-price">${fmtBRL(c.preco)} × ${c.qty} = ${fmtBRL(c.preco*c.qty)}</div>
      </div>
      <div class="cart-item-ctrl">
        <button class="qty-btn" onclick="removeItem(${c.id})">−</button>
        <span class="qty-num">${c.qty}</span>
        <button class="qty-btn" onclick="addItem(${c.id})">+</button>
      </div>
    </div>`).join('');
  const tot=STATE.cartItems.reduce((s,c)=>s+c.preco*c.qty,0);
  document.getElementById('cart-total').textContent=fmtBRL(tot);
  syncComandaHandle();
}
 
window.limparCart = () => {
  STATE.cartItems=[];
  renderCart();
  const p=document.getElementById('comanda-panel');
  if(p) p.classList.remove('expandida');
};
 
window.enviarPedido = async () => {
  if(!STATE.mesaSel){toast('Selecione uma mesa!','error');return;}
  if(!STATE.cartItems.length){toast('Adicione itens!','error');return;}
  const obs=document.getElementById('obs-inp').value.trim();
  const tot=STATE.cartItems.reduce((s,c)=>s+c.preco*c.qty,0);
  const now=Date.now(), pedId=uuid(), hoje=todayStr(), h=new Date().getHours();
  const user=STATE.currentUser?.nome||'Sistema';
 
  // FIX: garantir que a mesa está aberta com inicio definido
  const mesaAtual=DB.mesas[String(STATE.mesaSel)];
  if(!mesaAtual){toast('Mesa inválida','error');return;}
  if(mesaAtual.status==='livre'||!mesaAtual.inicio){
    const upd={status:'ocupada',inicio:now};
    await fsUpd('mesas',String(STATE.mesaSel),upd);
    DB.mesas[String(STATE.mesaSel)]={...mesaAtual,...upd};
  }
 
  const pedData={mesa_id:String(STATE.mesaSel),usuario:user,obs,total:tot,status:'preparo',criado:now};
  await fsSet('pedidos',pedId,pedData);
  DB.pedidos[pedId]={id:pedId,...pedData};
  sysLog(`Pedido #${pedId.substring(0,8)} — Mesa ${STATE.mesaSel} — ${fmtBRL(tot)}`);
 
  const batch=writeBatch(db);
  for(const c of STATE.cartItems){
    const itemRef=doc(col('pedido_itens'));
    batch.set(itemRef,{pedido_id:pedId,item_id:c.id,nome:c.nome,preco:c.preco,qty:c.qty});
    DB.pedido_itens[itemRef.id]={id:itemRef.id,pedido_id:pedId,item_id:c.id,nome:c.nome,preco:c.preco,qty:c.qty};
    Object.entries(c.ing||{}).forEach(([k,v])=>{
      if(DB.estoque[k]){const nq=Math.max(0,DB.estoque[k].qty-v*c.qty);batch.update(ref('estoque',k),{qty:nq});DB.estoque[k]={...DB.estoque[k],qty:nq};}
    });
    const rkKey=`${hoje}_${c.nome}`.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_\-]/g,'');
    const rk=DB.ranking_itens[rkKey];
    if(rk){batch.update(ref('ranking_itens',rkKey),{qty:rk.qty+c.qty,faturamento:(rk.faturamento||0)+c.preco*c.qty});DB.ranking_itens[rkKey]={...rk,qty:rk.qty+c.qty,faturamento:(rk.faturamento||0)+c.preco*c.qty};}
    else{const nrk={data:hoje,nome:c.nome,cat:c.cat,qty:c.qty,faturamento:c.preco*c.qty};batch.set(ref('ranking_itens',rkKey),nrk);DB.ranking_itens[rkKey]={id:rkKey,...nrk};}
    const catKey=`${hoje}_${c.cat}`.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_\-]/g,'');
    const fc=DB.fat_cat[catKey];
    if(fc){batch.update(ref('fat_cat',catKey),{valor:fc.valor+c.preco*c.qty});DB.fat_cat[catKey]={...fc,valor:fc.valor+c.preco*c.qty};}
    else{const nfc={data:hoje,cat:c.cat,valor:c.preco*c.qty};batch.set(ref('fat_cat',catKey),nfc);DB.fat_cat[catKey]={id:catKey,...nfc};}
  }
  const mesa=DB.mesas[String(STATE.mesaSel)];
  const nTotal=(mesa?.total||0)+tot;
  batch.update(ref('mesas',String(STATE.mesaSel)),{total:nTotal});
  DB.mesas[String(STATE.mesaSel)]={...mesa,total:nTotal};
 
  const horaKey=`${hoje}_${h}`;
  const fh=DB.fat_hora[horaKey];
  if(fh){batch.update(ref('fat_hora',horaKey),{valor:fh.valor+tot});DB.fat_hora[horaKey]={...fh,valor:fh.valor+tot};}
  else{const nfh={data:hoje,hora:h,valor:tot};batch.set(ref('fat_hora',horaKey),nfh);DB.fat_hora[horaKey]={id:horaKey,...nfh};}
 
  await batch.commit();
  STATE.cartItems=[];
  document.getElementById('obs-inp').value='';
  const p=document.getElementById('comanda-panel');
  if(p) p.classList.remove('expandida');
  renderCart(); renderKDS(); renderFloor();
  toast(`Pedido enviado! ${fmtBRL(tot)}`,'success');
};
 
// ════════════════════════════════════════════════
// COZINHA / KDS
// ════════════════════════════════════════════════
let kdsFilter='todos';
window.filtKDS=(f,btn)=>{
  kdsFilter=f;
  document.querySelectorAll('.kds-filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderKDS();
};
 
function renderKDS() {
  if(!STATE.dbReady) return;
  const pedidos=Object.values(DB.pedidos).filter(p=>p.status!=='cancelado').sort((a,b)=>a.criado-b.criado);
  const prep=pedidos.filter(p=>p.status==='preparo').length;
  const pronto=pedidos.filter(p=>p.status==='pronto').length;
  const total_ab=prep+pronto;
  document.getElementById('kd-prep').textContent=`${prep} preparo`;
  document.getElementById('kd-pronto').textContent=`${pronto} prontos`;
  const b1=document.getElementById('kds-count-badge'),b2=document.getElementById('mob-kds-badge');
  if(total_ab>0){b1.textContent=total_ab;b1.style.display='';if(b2){b2.textContent=total_ab;b2.style.display='';}}
  else{b1.style.display='none';if(b2)b2.style.display='none';}
  let filtered=kdsFilter==='todos'?pedidos.filter(p=>p.status!=='entregue'):pedidos.filter(p=>p.status===kdsFilter);
  const grid=document.getElementById('kds-grid');
  if(!filtered.length){grid.innerHTML=`<div class="kds-empty" style="grid-column:1/-1">✅<br><br>Nenhum pedido${kdsFilter!=='todos'?' neste filtro':' em aberto'}</div>`;return;}
  grid.innerHTML=filtered.map(p=>{
    const itens=Object.values(DB.pedido_itens).filter(i=>i.pedido_id===p.id);
    const elapsed=Date.now()-p.criado;
    const mins=Math.floor(elapsed/60000);
    const tc=mins>20?'late':mins>10?'warn':'ok';
    return `<div class="kds-card ${p.status} ${mins>20&&p.status==='preparo'?'urgente':''}">
      <div class="kds-card-header">
        <div><div class="kds-mesa">Mesa ${p.mesa_id}</div><div style="font-size:10px;color:var(--text3);">por ${p.usuario}</div></div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;">
          <span class="kds-timer ${tc}">⏱ ${tStr(elapsed)}</span>
          <span class="badge ${p.status==='preparo'?'b-amber':p.status==='pronto'?'b-green':'b-blue'}" style="font-size:10px;">
            ${p.status==='preparo'?'Preparo':p.status==='pronto'?'Pronto':'Entregue'}
          </span>
        </div>
      </div>
      <div class="kds-items">
        ${itens.map(i=>`<div class="kds-item"><span><span class="kds-item-qty">${i.qty}×</span> ${i.nome}</span><span style="color:var(--text2);font-size:11px;">${fmtBRL(i.preco*i.qty)}</span></div>`).join('')}
      </div>
      ${p.obs?`<div class="kds-obs">📝 ${p.obs}</div>`:''}
      <div class="kds-actions">
        ${p.status==='preparo'?`<button class="btn btn-green btn-sm" onclick="avancarPedido('${p.id}')">✅ Pronto</button>`:''}
        ${p.status==='pronto'?`<button class="btn btn-primary btn-sm" onclick="avancarPedido('${p.id}')">🚀 Entregue</button>`:''}
        <button class="btn btn-xs btn-red" style="margin-left:auto;" onclick="cancelarPedido('${p.id}')">Cancelar</button>
      </div>
    </div>`;
  }).join('');
}
 
window.avancarPedido = async (id) => {
  const p=DB.pedidos[id]; if(!p) return;
  const now=Date.now();
  if(p.status==='preparo'){
    await fsUpd('pedidos',id,{status:'pronto',atualizado:now});
    DB.pedidos[id]={...p,status:'pronto',atualizado:now};
    toast(`Pronto! Mesa ${p.mesa_id}`,'success');
  } else if(p.status==='pronto'){
    await fsUpd('pedidos',id,{status:'entregue',atualizado:now});
    DB.pedidos[id]={...p,status:'entregue',atualizado:now};
    const itens=Object.values(DB.pedido_itens).filter(i=>i.pedido_id===id);
    const qtd=itens.reduce((s,i)=>s+i.qty,0);
    const hoje=todayStr(), rd=DB.relatorio_dia[hoje]||{};
    const newRd={pedidos_total:(rd.pedidos_total||0)+1,faturamento:(rd.faturamento||0)+p.total,itens_total:(rd.itens_total||0)+qtd};
    await fsUpd('relatorio_dia',hoje,newRd);
    DB.relatorio_dia[hoje]={...(DB.relatorio_dia[hoje]||{}),...newRd,id:hoje,data:hoje};
    sysLog(`Entregue #${id.substring(0,8)} — Mesa ${p.mesa_id} — ${fmtBRL(p.total)}`);
    toast(`Entregue! Mesa ${p.mesa_id}`,'success');
  }
  renderKDS(); renderFloor(); renderCaixa();
  if(document.getElementById('page-relatorios').classList.contains('active')) renderRelatorios();
};
 
window.cancelarPedido = async (id) => {
  if(!confirm('Cancelar este pedido?')) return;
  const p=DB.pedidos[id];
  await fsUpd('pedidos',id,{status:'cancelado'});
  DB.pedidos[id]={...p,status:'cancelado'};
  sysLog(`Pedido ${id.substring(0,8)} cancelado`);
  renderKDS(); renderFloor();
  toast('Pedido cancelado','info');
};
 
// ════════════════════════════════════════════════
// CAIXA — FIX PRINCIPAL: pedidos agora aparecem corretamente
// ════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// CAIXA
// ═══════════════════════════════════════════════════════════════════
function renderCaixa() {
  if (!STATE.dbReady) return;
  const abertas = Object.values(DB.mesas).filter(m=>m.status!=='livre'&&m.total>0).sort((a,b)=>parseInt(a.id)-parseInt(b.id));
  const lista   = document.getElementById('caixa-lista');
  if (!abertas.length) { lista.innerHTML='<div class="text-muted text-sm" style="padding:12px 0;">Nenhuma mesa aberta</div>'; return; }
  lista.innerHTML = abertas.map(m=>`
    <button class="mesa-list-btn ${STATE.caixaMesa===m.id||STATE.caixaMesa===String(m.id)?'active':''}" onclick="selCaixaMesa('${m.id}')">
      <div class="mesa-list-num">Mesa ${m.id}</div>
      <div class="mesa-list-total">${fmtBRL(m.total)}</div>
      ${m.inicio?`<div class="mesa-list-time">há ${tStr(Date.now()-m.inicio)}</div>`:''}
    </button>`).join('');
  if (STATE.caixaMesa) renderCaixaDet();
}
 
window.selCaixaMesa = (id) => { STATE.caixaMesa=id; STATE.pgtoSel=null; STATE.removerTaxa=false; renderCaixa(); };
 
window.toggleTaxa = () => { STATE.removerTaxa = !STATE.removerTaxa; renderCaixaDet(); };
 
function renderCaixaDet() {
  const m       = DB.mesas[String(STATE.caixaMesa)];
  if (!m) return;
  // Filtra apenas pedidos da sessão atual (criados após abertura da mesa)
  const sesInicio = m.inicio || 0;
  const todos   = Object.values(DB.pedidos).filter(p=>
    (p.mesa_id===STATE.caixaMesa||p.mesa_id===String(STATE.caixaMesa)) &&
    p.status!=='cancelado' &&
    (p.criado||0) >= sesInicio
  );
  const todosItens = [];
  todos.forEach(p=>Object.values(DB.pedido_itens).filter(i=>i.pedido_id===p.id).forEach(i=>{
    const ex=todosItens.find(x=>x.nome===i.nome&&x.preco===i.preco);
    if(ex) ex.qty+=i.qty; else todosItens.push({...i});
  }));
  const sub  = todosItens.reduce((s,i)=>s+i.preco*i.qty,0);
  const taxaAplicada = STATE.removerTaxa ? 0 : sub*(SYS.taxaServico/100);
  const taxa = taxaAplicada;
  const tot  = sub+taxa;
  const abertos = todos.filter(p=>p.status!=='entregue').length;
 
  document.getElementById('caixa-det').innerHTML = `
    <div class="flex justify-between items-center" style="margin-bottom:14px;">
      <div>
        <div style="font-size:16px;font-weight:700;">Mesa ${STATE.caixaMesa}</div>
        ${m.inicio?`<div class="text-muted text-xs">Aberta há ${tStr(Date.now()-m.inicio)}</div>`:''}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <span class="badge b-amber">${m.status}</span>
        ${abertos>0?`<span class="badge b-red">${abertos} em aberto</span>`:''}
      </div>
    </div>
    <div class="caixa-det-itens">
      ${todosItens.map(i=>`<div class="conta-item"><div><div class="conta-item-name">${i.nome}</div><div class="conta-item-qty">${i.qty}× ${fmtBRL(i.preco)}</div></div><div style="font-weight:700;">${fmtBRL(i.preco*i.qty)}</div></div>`).join('')}
      ${!todosItens.length?'<div class="text-center text-muted" style="padding:16px;">Nenhum item</div>':''}
    </div>
    <div class="divider"></div>
    <div class="conta-total-row"><span class="text-muted">Subtotal</span><span>${fmtBRL(sub)}</span></div>
    <div class="conta-total-row" style="align-items:center;">
      <span class="text-muted" style="display:flex;align-items:center;gap:8px;">
        Taxa (${SYS.taxaServico}%)
        <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:12px;color:var(--text2);">
          <div onclick="toggleTaxa()" style="position:relative;display:inline-block;width:36px;height:20px;">
            <div style="position:absolute;inset:0;background:${STATE.removerTaxa?'var(--red-m,#ef4444)':'var(--green-m,#22c55e)'};border-radius:20px;transition:background .2s;"></div>
            <div style="position:absolute;top:3px;left:${STATE.removerTaxa?'3px':'17px'};width:14px;height:14px;background:#fff;border-radius:50%;transition:left .2s;"></div>
          </div>
          <span style="color:${STATE.removerTaxa?'var(--red,#dc2626)':'var(--green,#16a34a)'};">${STATE.removerTaxa?'Removida':'Cobrar'}</span>
        </label>
      </span>
      <span style="${STATE.removerTaxa?'text-decoration:line-through;color:var(--text3);':''}">${fmtBRL(sub*(SYS.taxaServico/100))}</span>
    </div>
    <div class="conta-total-row" style="border-top:1.5px solid var(--border-strong);padding-top:10px;margin-top:4px;">
      <span class="conta-total-final">Total</span><span class="conta-total-final">${fmtBRL(tot)}</span>
    </div>
    <div class="divider"></div>
    <div class="card-title" style="margin-bottom:10px;">Pagamento</div>
    <div class="pgto-grid">
      <button class="pgto-btn ${STATE.pgtoSel==='dinheiro'?'selected':''}" onclick="selPgto('dinheiro',${tot.toFixed(2)})"><span class="pgto-icon">💵</span><div class="pgto-label">Dinheiro</div></button>
      <button class="pgto-btn ${STATE.pgtoSel==='debito'?'selected':''}"   onclick="selPgto('debito',${tot.toFixed(2)})"><span class="pgto-icon">💳</span><div class="pgto-label">Débito</div></button>
      <button class="pgto-btn ${STATE.pgtoSel==='credito'?'selected':''}"  onclick="selPgto('credito',${tot.toFixed(2)})"><span class="pgto-icon">💳</span><div class="pgto-label">Crédito</div></button>
      <button class="pgto-btn ${STATE.pgtoSel==='pix'?'selected':''}"      onclick="selPgto('pix',${tot.toFixed(2)})"><span class="pgto-icon">📱</span><div class="pgto-label">Pix</div></button>
    </div>
    <div class="troco-input-wrap ${STATE.pgtoSel==='dinheiro'?'visible':''}" id="troco-wrap">
      <label class="input-label">Valor recebido</label>
      <input class="input mt-2" id="troco-val" type="number" step="0.01" placeholder="${tot.toFixed(2)}" min="${tot.toFixed(2)}">
      <div id="troco-result" style="font-size:13px;color:var(--green);font-weight:700;margin-top:6px;"></div>
    </div>
    <button class="btn btn-gold w-full mt-3" onclick="fecharConta(${sub.toFixed(2)},${taxa.toFixed(2)},${tot.toFixed(2)})">✅ Fechar Conta</button>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px;">
      <button class="btn btn-sm" onclick="abrirDividirConta(${tot.toFixed(2)})">÷ Dividir</button>
      <button class="btn btn-sm" onclick="abrirHistoricoMesa(${STATE.caixaMesa})">📋 Histórico</button>
      <button class="btn btn-sm" onclick="imprimirConta(${STATE.caixaMesa})">🖨️ Imprimir</button>
    </div>
  `;
  const tv=document.getElementById('troco-val');
  if(tv) tv.addEventListener('input',()=>{
    const rec=parseFloat(tv.value)||0;
    const tr=document.getElementById('troco-result');
    if(tr) tr.textContent=rec>=(tot)?`Troco: ${fmtBRL(rec-tot)}`:'';
  });
}
 
window.selPgto = (p,tot) => {
  STATE.pgtoSel=p;
  const tw=document.getElementById('troco-wrap');
  if(tw) tw.className=`troco-input-wrap ${p==='dinheiro'?'visible':''}`;
  document.querySelectorAll('.pgto-btn').forEach((b,i)=>{
    b.classList.toggle('selected',['dinheiro','debito','credito','pix'][i]===p);
  });
};
 
window.fecharConta = async (sub,taxa,tot) => {
  if (!STATE.pgtoSel) { toast('Selecione a forma de pagamento!','error'); return; }
  const id  = String(STATE.caixaMesa);
  const now = Date.now();
  let troco = 0;
  if (STATE.pgtoSel==='dinheiro') {
    const rec=parseFloat(document.getElementById('troco-val')?.value)||tot;
    troco=Math.max(0,rec-tot);
  }
  const hoje = todayStr();
  const batch = writeBatch(db);
 
  // Montar itens da conta para histórico (só pedidos da sessão atual)
  const sesInicio = DB.mesas[String(STATE.caixaMesa)]?.inicio || 0;
  const pedidosDaMesa = Object.values(DB.pedidos).filter(p=>
    (p.mesa_id===STATE.caixaMesa||p.mesa_id===String(STATE.caixaMesa)) &&
    p.status!=='cancelado' &&
    (p.criado||0) >= sesInicio
  );
  const itensDaConta = [];
  for (const p of pedidosDaMesa) {
    Object.values(DB.pedido_itens).filter(i=>i.pedido_id===p.id).forEach(i=>{
      const ex=itensDaConta.find(x=>x.nome===i.nome&&x.preco===i.preco);
      if(ex) ex.qty+=i.qty; else itensDaConta.push({...i});
    });
  }
 
  // Registrar fat por pgto
  const pgtoKey=`${hoje}_${STATE.pgtoSel}`;
  const fp=DB.fat_pgto[pgtoKey];
  if(fp){batch.update(ref('fat_pgto',pgtoKey),{valor:fp.valor+tot,qtd:fp.qtd+1});DB.fat_pgto[pgtoKey]={...fp,valor:fp.valor+tot,qtd:fp.qtd+1};}
  else{const nfp={data:hoje,forma:STATE.pgtoSel,valor:tot,qtd:1};batch.set(ref('fat_pgto',pgtoKey),nfp);DB.fat_pgto[pgtoKey]={id:pgtoKey,...nfp};}
 
  // Pedidos abertos → entregues (só da sessão atual)
  const abertos = Object.values(DB.pedidos).filter(p=>
    (p.mesa_id===STATE.caixaMesa||p.mesa_id===String(STATE.caixaMesa)) &&
    p.status!=='entregue' && p.status!=='cancelado' &&
    (p.criado||0) >= sesInicio
  );
  let fatExtra=0,itExtra=0;
  for(const p of abertos){
    const its=Object.values(DB.pedido_itens).filter(i=>i.pedido_id===p.id);
    itExtra+=its.reduce((s,i)=>s+i.qty,0);
    fatExtra+=p.total;
    batch.update(ref('pedidos',p.id),{status:'entregue'});
    DB.pedidos[p.id]={...p,status:'entregue'};
  }
  if(fatExtra>0){
    const rd=DB.relatorio_dia[hoje]||{};
    const nrd={pedidos_total:(rd.pedidos_total||0)+1,faturamento:(rd.faturamento||0)+fatExtra,itens_total:(rd.itens_total||0)+itExtra};
    batch.update(ref('relatorio_dia',hoje),nrd);
    DB.relatorio_dia[hoje]={...(DB.relatorio_dia[hoje]||{}),...nrd,id:hoje,data:hoje};
  }
 
  // Liberar mesa
  batch.update(ref('mesas',id),{status:'livre',inicio:null,total:0});
  await batch.commit();
  DB.mesas[id]={...DB.mesas[id],status:'livre',inicio:null,total:0};
 
  // Salvar histórico de conta fechada
  const contaId = uuid();
  const contaData = {
    mesa_id: id,
    fechadoEm: Date.now(),
    fechadoPor: STATE.currentUser?.nome||'Sistema',
    subtotal: sub,
    taxa,
    total: tot,
    forma_pagamento: STATE.pgtoSel,
    troco,
    itens: itensDaConta,
  };
  await fsSet('contas_fechadas', contaId, contaData);
  DB.contas_fechadas[contaId] = {id:contaId, ...contaData};
 
  sysLog(`Conta fechada Mesa ${id} — ${fmtBRL(tot)} (${STATE.pgtoSel})`);
  const p=STATE.pgtoSel;
  STATE.caixaMesa=null; STATE.pgtoSel=null;
  document.getElementById('caixa-det').innerHTML='<div class="text-center text-muted" style="padding:50px 0;font-size:13px;">Selecione uma mesa</div>';
  renderCaixa(); renderFloor();
  if(document.getElementById('page-relatorios').classList.contains('active')) renderRelatorios();
  toast(`Conta fechada! ${fmtBRL(tot)} — ${p}${troco>0?` — Troco: ${fmtBRL(troco)}`:''}`, 'success');
};
 
window.abrirHistoricoMesa = (mesaId) => {
  const id = String(mesaId);
  const contas = Object.values(DB.contas_fechadas)
    .filter(c => String(c.mesa_id) === id)
    .sort((a,b) => b.fechadoEm - a.fechadoEm)
    .slice(0, 20);
 
  const pgtoLabel = {dinheiro:'💵 Dinheiro', debito:'💳 Débito', credito:'💳 Crédito', pix:'📱 Pix'};
 
  document.getElementById('modal-historico-sub').textContent =
    `Mesa ${id} — ${contas.length} conta(s) fechada(s)`;
 
  document.getElementById('modal-historico-list').innerHTML = contas.length
    ? contas.map(c => {
        const dt = new Date(c.fechadoEm).toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
        const itensHtml = (c.itens||[]).map(i =>
          `<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);padding:1px 0;">
            <span>${i.qty}× ${i.nome}</span><span>${fmtBRL(i.preco*i.qty)}</span>
          </div>`).join('');
        return `<div style="padding:12px 0;border-bottom:1px solid var(--border);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--text);">${fmtBRL(c.total)}</div>
              <div style="font-size:11px;color:var(--text3);">${dt} · ${pgtoLabel[c.forma_pagamento]||c.forma_pagamento}</div>
              <div style="font-size:11px;color:var(--text3);">Fechado por: ${c.fechadoPor||'—'}</div>
            </div>
            ${c.troco>0?`<span class="badge b-green">Troco ${fmtBRL(c.troco)}</span>`:''}
          </div>
          ${itensHtml}
        </div>`;
      }).join('')
    : '<div class="text-center text-muted" style="padding:24px;">Nenhuma conta fechada para esta mesa</div>';
 
  openModal('modal-historico');
  
};
  
// No seu main.js, garanta que estas funções sejam globais:

window.abrirDividirConta = (total) => {
  // Se você já tiver a lógica da função, coloque-a aqui ou chame-a
  console.log("Abrindo modal para dividir:", total);
  
  // Exemplo de lógica para abrir o seu modal (ajuste o ID conforme seu HTML)
  const modal = document.getElementById('modal-dividir-conta'); 
if(modal) modal.classList.add('open');  
  // Chama a função de cálculo
  window.calcDividir(total);
};

window.calcDividir = (tot) => {
  const nInput = document.getElementById('dividir-n');
  const n = nInput ? (parseInt(nInput.value) || 1) : 1;
  const por = tot / n;

  const resEl = document.getElementById('dividir-result');
  if (resEl) {
    resEl.innerHTML = n >= 1 
      ? `<div style="font-size:22px;font-weight:700;color:var(--brand-m);text-align:center;margin-top:8px;">
           ${fmtBRL(por)}
           <span style="font-size:13px;font-weight:400;color:var(--text3);"> / pessoa</span>
         </div>`
      : '';
  }

  const totValEl = document.getElementById('dividir-total-val');
  if (totValEl) totValEl.textContent = fmtBRL(tot);
};

// Certifique-se que a fmtBRL também seja global se for usada em outros lugares
window.fmtBRL = (val) => {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

window.fecharDividirConta = () => {
  const modal = document.getElementById('modal-dividir-conta');
  if(modal) {
    modal.style.display = 'none';
  }
};
window.imprimirConta = (mesaId) => {
  const m = DB.mesas[String(mesaId)]; if(!m) return;
  const sesInicio = m.inicio||0;
  const todos = Object.values(DB.pedidos).filter(p=>
    (p.mesa_id===mesaId||p.mesa_id===String(mesaId)) && p.status!=='cancelado' && (p.criado||0)>=sesInicio
  );
  const itens = [];
  todos.forEach(p=>Object.values(DB.pedido_itens).filter(i=>i.pedido_id===p.id).forEach(i=>{
    const ex=itens.find(x=>x.nome===i.nome&&x.preco===i.preco);
    if(ex) ex.qty+=i.qty; else itens.push({...i});
  }));
  const sub = itens.reduce((s,i)=>s+i.preco*i.qty,0);
  const taxa = STATE.removerTaxa ? 0 : sub*(SYS.taxaServico/100);
  const tot = sub+taxa;
  const agora = new Date().toLocaleString('pt-BR');
  const pa = document.getElementById('print-area');
  pa.innerHTML = `
    <div class="print-title">🍽️ ${SYS.nomeRestaurante}</div>
    <div style="text-align:center;font-size:10px;margin-bottom:6px;">${agora}</div>
    <div style="text-align:center;font-size:13px;font-weight:700;margin-bottom:4px;">MESA ${mesaId}</div>
    <div class="print-sep"></div>
    ${itens.map(i=>`<div class="print-row"><span>${i.qty}x ${i.nome}</span><span>${fmtBRL(i.preco*i.qty)}</span></div>`).join('')}
    <div class="print-sep"></div>
    <div class="print-row"><span>Subtotal</span><span>${fmtBRL(sub)}</span></div>
    ${!STATE.removerTaxa?`<div class="print-row"><span>Taxa (${SYS.taxaServico}%)</span><span>${fmtBRL(taxa)}</span></div>`:''}
    <div class="print-sep"></div>
    <div class="print-row print-total"><span>TOTAL</span><span>${fmtBRL(tot)}</span></div>
    ${STATE.pgtoSel?`<div style="text-align:center;margin-top:6px;font-size:11px;">Pagamento: ${STATE.pgtoSel}</div>`:''}
    <div style="text-align:center;margin-top:8px;font-size:10px;">Obrigado pela preferência!</div>
  `;
  setTimeout(()=>window.print(), 80);
};
 
// ════════════════════════════════════════════════
// ESTOQUE
// ════════════════════════════════════════════════
function calcularPrevisaoAcabamento(item) {
  const sete=Date.now()-7*24*60*60*1000;
  let consumoTotal=0;
  Object.values(DB.pedidos).filter(p=>p.status==='entregue'&&(p.criado||0)>=sete).forEach(p=>{
    Object.values(DB.pedido_itens).filter(i=>i.pedido_id===p.id).forEach(i=>{
      const card=DB.cardapio[i.item_id]; if(!card) return;
      const ing=JSON.parse(card.ing||'{}');
      if(ing[item.id]!==undefined) consumoTotal+=(ing[item.id]||0)*i.qty;
    });
  });
  const media=consumoTotal/7;
  if(media<=0) return null;
  return Math.floor(item.qty/media);
}
 
function renderEstoque() {
  if(!STATE.dbReady) return;
  const busca=document.getElementById('est-search')?.value?.toLowerCase()||'';
  let itens=Object.values(DB.estoque).sort((a,b)=>a.nome.localeCompare(b.nome));
  if(busca) itens=itens.filter(i=>i.nome.toLowerCase().includes(busca));
  const criticos=Object.values(DB.estoque).filter(v=>v.qty<v.max_qty*0.2).length;
  const baixos=Object.values(DB.estoque).filter(v=>v.qty>=v.max_qty*0.2&&v.qty<v.max_qty*SYS.alertaEstoque).length;
  const totalItens=Object.keys(DB.estoque).length;
  const totalMax=Object.values(DB.estoque).reduce((s,v)=>s+v.max_qty,0);
  const totalAtual=Object.values(DB.estoque).reduce((s,v)=>s+v.qty,0);
  const pctGeral=totalMax>0?Math.round(totalAtual/totalMax*100):0;
  const resumoEl=document.getElementById('est-resumo');
  if(resumoEl) resumoEl.innerHTML=`
    <div class="metric-card text-center"><div class="metric-val" style="color:var(--green)">${pctGeral}%</div><div class="metric-label">Ocupação</div></div>
    <div class="metric-card text-center"><div class="metric-val">${totalItens}</div><div class="metric-label">Ingredientes</div></div>
    <div class="metric-card text-center"><div class="metric-val" style="color:var(--red)">${criticos}</div><div class="metric-label">Críticos</div></div>
    <div class="metric-card text-center"><div class="metric-val" style="color:var(--amber)">${baixos}</div><div class="metric-label">Baixos</div></div>
  `;
  document.getElementById('est-list').innerHTML=itens.map(v=>{
    const id=v.id||v.chave;
    const pct=Math.min(1,v.qty/v.max_qty);
    const cor=pct<0.2?'var(--red-m)':pct<0.4?'var(--amber-m)':'var(--green-m)';
    const dias=calcularPrevisaoAcabamento(v);
    const prevTxt=dias!==null?(dias<=2?`⚠️ Acaba em ${dias}d`:`~${dias} dias`):'';
    const prevCor=dias!==null&&dias<=2?'var(--red)':'var(--text3)';
    return `<div class="est-item">
      <div class="est-icon">${v.icon||'📦'}</div>
      <div class="est-info">
        <div class="est-name">${v.nome}</div>
        <div class="est-qty-text">${Number(v.qty).toFixed(1)} / ${v.max_qty} ${v.unidade}${prevTxt?` · <span style="color:${prevCor};font-size:10px;">${prevTxt}</span>`:''}</div>
        <div class="est-bar-wrap"><div class="est-bar" style="width:${Math.round(pct*100)}%;background:${cor}"></div></div>
      </div>
      <div class="est-pct" style="color:${cor}">${Math.round(pct*100)}%</div>
      <div class="est-actions">
        <button class="btn btn-xs" onclick="openReporModal('${id}')">Repor</button>
        <button class="btn btn-xs" onclick="abrirAjusteManual('${id}')">±</button>
        <button class="btn btn-xs" onclick="abrirMovimentacoes('${id}')">📋</button>
        <button class="btn btn-xs btn-red" onclick="removerIngrediente('${id}')">✕</button>
      </div>
    </div>`;
  }).join('');
  const alertas=Object.values(DB.estoque).filter(v=>v.qty<v.max_qty*SYS.alertaEstoque).sort((a,b)=>a.qty/a.max_qty-b.qty/b.max_qty);
  document.getElementById('alertas-list').innerHTML=alertas.length
    ?alertas.map(v=>{const dias=calcularPrevisaoAcabamento(v);return `<div class="alerta-item"><div><div class="alerta-name">${v.icon||'⚠️'} ${v.nome}</div><div class="alerta-qty">Resta ${Number(v.qty).toFixed(1)} ${v.unidade}${dias!==null?` · ~${dias}d`:''}</div></div><button class="btn btn-xs btn-green" onclick="reporItem('${v.id||v.chave}')">Repor</button></div>`;}).join('')
    :'<div class="text-muted text-sm text-center" style="padding:12px 0;">Sem alertas 🎉</div>';
}
window.renderEstoque=renderEstoque;
 
window.openReporModal=(chave)=>{
  const item=DB.estoque[chave];
  document.getElementById('modal-repor-desc').textContent=`${item.nome}: ${Number(item.qty).toFixed(1)} ${item.unidade} (máx: ${item.max_qty}).`;
  document.getElementById('repor-qty').value=(item.max_qty-item.qty).toFixed(1);
  document.getElementById('repor-key').value=chave;
  openModal('modal-repor');
};
window.confirmarRepor=async()=>{
  const chave=document.getElementById('repor-key').value;
  const qty=parseFloat(document.getElementById('repor-qty').value)||0;
  const item=DB.estoque[chave];
  const nq=Math.min(item.max_qty,item.qty+qty);
  await fsUpd('estoque',chave,{qty:nq});
  DB.estoque[chave]={...item,qty:nq};
  sysLog(`Reposto: ${item.nome} → ${nq.toFixed(1)} ${item.unidade}`);
  closeModal('modal-repor'); renderEstoque();
  toast(`${item.nome} reposto!`,'success');
};
window.reporItem=async(chave)=>{
  const item=DB.estoque[chave];
  await fsUpd('estoque',chave,{qty:item.max_qty});
  DB.estoque[chave]={...item,qty:item.max_qty};
  renderEstoque(); toast(`${item.nome} reposto!`,'success');
};
window.reporTudo=async()=>{
  if(!confirm('Repor tudo ao máximo?')) return;
  const batch=writeBatch(db);
  Object.entries(DB.estoque).forEach(([k,v])=>{batch.update(ref('estoque',k),{qty:v.max_qty});DB.estoque[k]={...v,qty:v.max_qty};});
  await batch.commit(); renderEstoque(); toast('Estoque reposto!','success');
};
window.addIngrediente=async()=>{
  const nome=document.getElementById('new-ing-nome').value.trim();
  const qty=parseFloat(document.getElementById('new-ing-qty').value)||0;
  const max=parseFloat(document.getElementById('new-ing-max').value)||10;
  const un=document.getElementById('new-ing-un').value;
  const icon=document.getElementById('new-ing-icon').value||'📦';
  if(!nome){toast('Informe o nome','error');return;}
  if(qty<0||max<=0){toast('Quantidades não podem ser negativas','error');return;}
  if(qty>max){toast('Quantidade atual não pode superar o máximo','error');return;}
  const chave=nome.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
  if(DB.estoque[chave]){toast('Já existe','error');return;}
  const d={nome,icon,qty,max_qty:max,unidade:un};
  await fsSet('estoque',chave,d);
  DB.estoque[chave]={id:chave,...d};
  ['new-ing-nome','new-ing-qty','new-ing-max','new-ing-icon'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  closeModal('modal-add-ing'); renderEstoque();
  toast(`${nome} adicionado!`,'success');
};
window.removerIngrediente=async(chave)=>{
  const item=DB.estoque[chave];
  if(!confirm(`Remover "${item?.nome}"?`)) return;
  await fsDel('estoque',chave); delete DB.estoque[chave];
  renderEstoque(); toast('Ingrediente removido','info');
};
window.abrirAjusteManual=(chave)=>{
  const item=DB.estoque[chave]; if(!item) return;
  document.getElementById('ajuste-key').value=chave;
  document.getElementById('ajuste-nome').textContent=`${item.icon||'📦'} ${item.nome} — atual: ${Number(item.qty).toFixed(1)} ${item.unidade}`;
  document.getElementById('ajuste-tipo').value='entrada';
  document.getElementById('ajuste-qty').value='';
  document.getElementById('ajuste-motivo').value='';
  openModal('modal-ajuste-estoque');
};
window.confirmarAjuste=async()=>{
  const chave=document.getElementById('ajuste-key').value;
  const tipo=document.getElementById('ajuste-tipo').value;
  const qty=parseFloat(document.getElementById('ajuste-qty').value);
  const motivo=document.getElementById('ajuste-motivo').value.trim();
  if(!qty||qty<=0){toast('Quantidade inválida','error');return;}
  const item=DB.estoque[chave]; if(!item){toast('Ingrediente não encontrado','error');return;}
  let novaQty;
  if(tipo==='entrada') novaQty=Math.min(item.max_qty,item.qty+qty);
  else if(tipo==='saida') novaQty=Math.max(0,item.qty-qty);
  else novaQty=Math.min(item.max_qty,Math.max(0,qty));
  await fsUpd('estoque',chave,{qty:novaQty});
  DB.estoque[chave]={...item,qty:novaQty};
  const mov={chave,nome:item.nome,tipo,qty,motivo:motivo||'Ajuste manual',data:todayStr(),hora:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),ts:Date.now(),usuario:STATE.currentUser?.nome||'Sistema'};
  await fsAdd('movimentacoes_estoque',mov);
  sysLog(`Estoque ${item.nome}: ${tipo} ${qty} ${item.unidade} → ${novaQty.toFixed(1)}`);
  closeModal('modal-ajuste-estoque'); renderEstoque();
  toast(`${item.nome} atualizado!`,'success');
};
window.abrirMovimentacoes=async(chave)=>{
  const item=DB.estoque[chave]; if(!item) return;
  document.getElementById('modal-mov-title').textContent=`Histórico — ${item.nome}`;
  document.getElementById('modal-mov-list').innerHTML='<div class="text-muted text-sm text-center" style="padding:12px;">Carregando...</div>';
  openModal('modal-movimentacoes');
  try{
    const snap=await getDocs(col('movimentacoes_estoque'));
    const movs=snap.docs.map(d=>({id:d.id,...d.data()})).filter(m=>m.chave===chave).sort((a,b)=>b.ts-a.ts).slice(0,40);
    document.getElementById('modal-mov-list').innerHTML=movs.length
      ?movs.map(m=>{const cor=m.tipo==='entrada'?'var(--green)':m.tipo==='saida'?'var(--red)':'var(--blue-m)';const sinal=m.tipo==='entrada'?'+':m.tipo==='saida'?'-':'±';return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--border);"><div style="width:32px;height:32px;border-radius:50%;background:${cor}20;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:${cor};flex-shrink:0;">${sinal}</div><div style="flex:1;"><div style="font-size:12px;font-weight:600;">${m.tipo.charAt(0).toUpperCase()+m.tipo.slice(1)} — ${m.qty} ${item.unidade}</div><div style="font-size:11px;color:var(--text3);">${m.motivo||'—'} · ${m.data||''} ${m.hora||''} · ${m.usuario||''}</div></div><div style="font-size:13px;font-weight:700;color:${cor};">${sinal}${m.qty}</div></div>`;}).join('')
      :'<div class="text-center text-muted" style="padding:20px;">Nenhuma movimentação registrada</div>';
  }catch(e){document.getElementById('modal-mov-list').innerHTML='<div class="text-muted text-sm text-center" style="padding:12px;">Erro ao carregar</div>';}
};
 
// ════════════════════════════════════════════════
// CARDÁPIO ADMIN
// ════════════════════════════════════════════════
let adminCatFiltro='Todos';
function renderCardapioAdmin() {
  if(!STATE.dbReady) return;
  const itens=Object.values(DB.cardapio).sort((a,b)=>(a.cat+a.nome).localeCompare(b.cat+b.nome));
  const cats=['Todos',...new Set(itens.map(i=>i.cat))];
  document.getElementById('cardapio-cat-bar').innerHTML=cats.map(c=>`<button class="cat-chip ${c===adminCatFiltro?'active':''}" onclick="filtAdminCat('${c}')">${c}</button>`).join('');
  const filtered=adminCatFiltro==='Todos'?itens:itens.filter(i=>i.cat===adminCatFiltro);
  document.getElementById('cardapio-admin-grid').innerHTML=filtered.map(i=>`
    <div class="cardapio-admin-card ${!i.ativo?'unavailable':''}">
      <div class="cardapio-admin-top">
        <div><div style="font-size:22px;">${i.icon||'🍽️'}</div><div class="cardapio-admin-name">${i.nome}</div><div class="cardapio-admin-cat">${i.cat}</div></div>
        <button class="btn btn-xs" onclick="openEditItemModal('${i.id}')">✏️</button>
      </div>
      <div class="cardapio-admin-price">${fmtBRL(i.preco)}</div>
      <div style="font-size:11px;color:var(--text3);">⏱ ${i.tempo||15}min</div>
      <div class="cardapio-admin-footer">
        <span class="badge ${i.ativo?'b-green':'b-red'}">${i.ativo?'Ativo':'Inativo'}</span>
        <label class="toggle"><input type="checkbox" ${i.ativo?'checked':''} onchange="toggleItem('${i.id}',this.checked)"><span class="toggle-slider"></span></label>
      </div>
    </div>`).join('');
}
window.filtAdminCat=(cat)=>{adminCatFiltro=cat;renderCardapioAdmin();};
window.openAddItemModal=()=>{
  document.getElementById('modal-item-title').textContent='Novo item';
  document.getElementById('item-edit-id').value='';
  ['item-nome','item-preco','item-icon','item-tempo'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  openModal('modal-item-cardapio');
};
window.openEditItemModal=(id)=>{
  const item=DB.cardapio[String(id)]; if(!item) return;
  document.getElementById('modal-item-title').textContent='Editar item';
  document.getElementById('item-edit-id').value=id;
  document.getElementById('item-nome').value=item.nome;
  document.getElementById('item-preco').value=item.preco;
  document.getElementById('item-cat').value=item.cat;
  document.getElementById('item-tempo').value=item.tempo||15;
  document.getElementById('item-icon').value=item.icon||'';
  openModal('modal-item-cardapio');
};
window.salvarItem=async()=>{
  const id=document.getElementById('item-edit-id').value;
  const nome=document.getElementById('item-nome').value.trim();
  const preco=parseFloat(document.getElementById('item-preco').value);
  const cat=document.getElementById('item-cat').value;
  const tempo=parseInt(document.getElementById('item-tempo').value)||15;
  const icon=document.getElementById('item-icon').value||'🍽️';
  if(!nome){toast('Informe o nome','error');return;}
  if(!preco||preco<=0){toast('Preço inválido','error');return;}
  if(id){
    await fsUpd('cardapio',String(id),{nome,preco,cat,tempo,icon});
    DB.cardapio[String(id)]={...DB.cardapio[String(id)],nome,preco,cat,tempo,icon};
    toast('Item atualizado!','success');
  } else {
    const nid=await fsAdd('cardapio',{nome,cat,preco,tempo,icon,ing:'{}',ativo:1});
    DB.cardapio[nid]={id:nid,nome,cat,preco,tempo,icon,ing:'{}',ativo:1};
    toast('Item adicionado!','success');
  }
  closeModal('modal-item-cardapio'); renderCardapioAdmin(); renderCardapio();
};
window.toggleItem=async(id,ativo)=>{
  await fsUpd('cardapio',String(id),{ativo:ativo?1:0});
  DB.cardapio[String(id)]={...DB.cardapio[String(id)],ativo:ativo?1:0};
  renderCardapioAdmin(); renderCardapio();
};
 
// ════════════════════════════════════════════════
// RELATÓRIOS
// ════════════════════════════════════════════════
let relPeriod='hoje';
window.setRelPeriod=(p,btn)=>{relPeriod=p;document.querySelectorAll('.rel-period-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderRelatorios();};
 
function getRelDatas() {
  const hoje=todayStr();
  if(relPeriod==='hoje') return [hoje];
  const count=relPeriod==='semana'?7:30, datas=[];
  for(let i=count-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);datas.push(`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`);}
  return datas;
}
 
function renderRelatorios() {
  if(!STATE.dbReady) return;
  const datas=new Set(getRelDatas());
  const rels=Object.values(DB.relatorio_dia).filter(r=>datas.has(r.id||r.data));
  const fat=rels.reduce((s,r)=>s+(r.faturamento||0),0);
  const ped=rels.reduce((s,r)=>s+(r.pedidos_total||0),0);
  const itens=rels.reduce((s,r)=>s+(r.itens_total||0),0);
  const ticket=ped>0?fat/ped:0;
  document.getElementById('rel-metrics').innerHTML=`
    <div class="metric-card text-center"><div class="metric-val">${fmtBRL(fat)}</div><div class="metric-label">Faturamento</div></div>
    <div class="metric-card text-center"><div class="metric-val">${ped}</div><div class="metric-label">Pedidos</div></div>
    <div class="metric-card text-center"><div class="metric-val">${fmtBRL(ticket)}</div><div class="metric-label">Ticket médio</div></div>
    <div class="metric-card text-center"><div class="metric-val">${itens}</div><div class="metric-label">Itens vendidos</div></div>
  `;
  if(relPeriod==='hoje'){
    const horas=Object.values(DB.fat_hora).filter(h=>datas.has(h.data)).sort((a,b)=>a.hora-b.hora);
    const maxH=Math.max(...horas.map(h=>h.valor),1);
    document.getElementById('chart-horas').innerHTML=horas.length?horas.map(h=>`<div class="chart-bar-col"><div class="chart-bar-val">${h.valor>=1000?(h.valor/1000).toFixed(1)+'k':Math.round(h.valor)}</div><div class="chart-bar-rect" style="height:${Math.max(4,Math.round(h.valor/maxH*100))}px"></div></div>`).join(''):'<div class="text-center text-muted" style="padding:20px;width:100%">Sem dados</div>';
    document.getElementById('chart-horas-labels').innerHTML=horas.map(h=>`<span class="chart-bar-label">${h.hora}h</span>`).join('');
  } else {
    const datasArr=[...datas].sort();
    const fatD=datasArr.map(d=>({d,f:(DB.relatorio_dia[d]?.faturamento||0)}));
    const maxD=Math.max(...fatD.map(x=>x.f),1);
    document.getElementById('chart-horas').innerHTML=fatD.map(x=>`<div class="chart-bar-col"><div class="chart-bar-val">${x.f>=1000?(x.f/1000).toFixed(1)+'k':Math.round(x.f)}</div><div class="chart-bar-rect" style="height:${Math.max(4,Math.round(x.f/maxD*100))}px"></div></div>`).join('');
    document.getElementById('chart-horas-labels').innerHTML=fatD.map(x=>{const p=x.d.split('-');return`<span class="chart-bar-label">${p[2]}/${p[1]}</span>`;}).join('');
  }
  const rankMap={};
  Object.values(DB.ranking_itens).filter(r=>datas.has(r.data)).forEach(r=>{if(!rankMap[r.nome])rankMap[r.nome]={nome:r.nome,qty:0,fat:0};rankMap[r.nome].qty+=r.qty||0;rankMap[r.nome].fat+=r.faturamento||0;});
  const rank=Object.values(rankMap).sort((a,b)=>b.qty-a.qty).slice(0,8);
  const maxR=rank.length?rank[0].qty:1;
  document.getElementById('ranking-list').innerHTML=rank.length?rank.map((r,i)=>`<div class="rank-item"><div class="rank-pos">${i+1}</div><div class="rank-name">${r.nome}</div><div class="rank-bar-wrap"><div class="rank-bar" style="width:${Math.round(r.qty/maxR*100)}%"></div></div><div class="rank-qty">${r.qty}</div></div>`).join(''):'<div class="text-muted text-sm text-center" style="padding:16px;">Sem dados</div>';
  const catMap={};
  Object.values(DB.fat_cat).filter(r=>datas.has(r.data)).forEach(r=>{catMap[r.cat]=(catMap[r.cat]||0)+(r.valor||0);});
  const fatCat=Object.entries(catMap).map(([c,v])=>({c,v})).sort((a,b)=>b.v-a.v);
  const maxC=fatCat.length?fatCat[0].v:1;
  document.getElementById('cat-fat-list').innerHTML=fatCat.length?fatCat.map(x=>`<div class="rank-item"><div class="rank-name">${x.c}</div><div class="rank-bar-wrap"><div class="rank-bar" style="width:${Math.round(x.v/maxC*100)}%;background:var(--brand-m)"></div></div><div class="rank-qty">${fmtBRL(x.v)}</div></div>`).join(''):'<div class="text-muted text-sm text-center" style="padding:16px;">Sem dados</div>';
  const pgtoMap={};
  Object.values(DB.fat_pgto).filter(r=>datas.has(r.data)).forEach(r=>{if(!pgtoMap[r.forma])pgtoMap[r.forma]={f:r.forma,v:0,q:0};pgtoMap[r.forma].v+=r.valor||0;pgtoMap[r.forma].q+=r.qtd||0;});
  const icons={dinheiro:'💵',debito:'💳',credito:'💳',pix:'📱'};
  document.getElementById('pgto-fat-list').innerHTML=Object.values(pgtoMap).sort((a,b)=>b.v-a.v).length?Object.values(pgtoMap).sort((a,b)=>b.v-a.v).map(p=>`<div class="conta-total-row" style="padding:8px 0;"><span>${icons[p.f]||'💳'} ${p.f} (${p.q}×)</span><span style="font-weight:700;">${fmtBRL(p.v)}</span></div>`).join(''):'<div class="text-muted text-sm text-center" style="padding:16px;">Sem dados</div>';
}
 
// ════════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════════
window.salvarConfig=async()=>{
  const nome=document.getElementById('cfg-nome').value.trim()||SYS.nomeRestaurante;
  const taxa=parseFloat(document.getElementById('cfg-taxa').value)||SYS.taxaServico;
  const nm=parseInt(document.getElementById('cfg-mesas').value)||SYS.nMesas;
  await Promise.all([fsSet('config','nome_restaurante',{valor:nome}),fsSet('config','taxa_servico',{valor:String(taxa)}),fsSet('config','n_mesas',{valor:String(nm)})]);
  DB.config['nome_restaurante']=nome;DB.config['taxa_servico']=String(taxa);DB.config['n_mesas']=String(nm);
  SYS.nomeRestaurante=nome;SYS.taxaServico=taxa;
  const atualCount=Object.keys(DB.mesas).length;
  if(nm>atualCount){for(let i=atualCount+1;i<=nm;i++){const m={status:'livre',capacidade:4,inicio:null,total:0};await fsSet('mesas',String(i),m);DB.mesas[String(i)]={id:String(i),...m};}}
  renderFloor(); toast('Configurações salvas!','success');
};
 
// FIX: Exportar dados agora funciona corretamente
window.exportarDados=()=>{
  const dados={mesas:DB.mesas,cardapio:DB.cardapio,pedidos:DB.pedidos,estoque:DB.estoque,relatorio_dia:DB.relatorio_dia,contas_fechadas:DB.contas_fechadas,exportadoEm:new Date().toISOString()};
  const blob=new Blob([JSON.stringify(dados,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`restaurantos_backup_${todayStr()}.json`;
  a.click();
  toast('Dados exportados!','success');
};
 
window.mostrarChaveAcesso=()=>{
  function gerarChavePeriodo(){
    const base=new Date();
    const bloco=Math.floor((base.getDate()-1)/10);
    const semente=`${base.getFullYear()}-${base.getMonth()}-${bloco}`;
    let h=0;
    for(let i=0;i<semente.length;i++) h=Math.imul(31,h)+semente.charCodeAt(i)|0;
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let chave='',n=Math.abs(h);
    for(let i=0;i<8;i++){chave+=chars[n%chars.length];n=Math.floor(n/chars.length)||(n*7+i+1);}
    return chave.slice(0,4)+'-'+chave.slice(4);
  }
  const display=document.getElementById('chave-acesso-display');
  if(display.style.display!=='none'){display.style.display='none';return;}
  const chave=gerarChavePeriodo();
  const hoje=new Date();
  const bloco=Math.floor((hoje.getDate()-1)/10);
  const fimBloco=Math.min((bloco+1)*10,new Date(hoje.getFullYear(),hoje.getMonth()+1,0).getDate());
  const validade=`Válida até dia ${fimBloco}/${String(hoje.getMonth()+1).padStart(2,'0')}`;
  document.getElementById('chave-acesso-valor').textContent=chave;
  document.getElementById('chave-acesso-validade').textContent=validade;
  display.style.display='block';
};
 
window.resetarSistema=async()=>{
  if(!confirm('APAGAR TODOS OS DADOS?')) return;
  if(!confirm('Tem certeza? Esta ação não pode ser desfeita.')) return;
  const cols=['mesas','cardapio','pedidos','pedido_itens','estoque','config','relatorio_dia','fat_hora','ranking_itens','fat_pgto','fat_cat','contas_fechadas','relatorios_mensais'];
  for(const c of cols){const snaps=await getDocs(col(c));for(const d of snaps.docs) await fsDel(c,d.id);}
  Object.keys(DB).forEach(k=>{DB[k]={};});
  toast('Dados apagados. Recarregando...','info');
  setTimeout(()=>location.reload(),1500);
};
 
function renderConfigPage() {
  document.getElementById('cfg-nome').value=SYS.nomeRestaurante;
  document.getElementById('cfg-taxa').value=SYS.taxaServico;
  document.getElementById('cfg-mesas').value=Object.keys(DB.mesas).length||SYS.nMesas;
  document.getElementById('usuarios-list').innerHTML=Object.values(DB.usuarios).map(u=>{
    const rc=ROLE_CONFIG[u.role]||ROLE_CONFIG.garcom;
    const isMe=STATE.currentUser?.uid===u.uid||STATE.currentUser?.uid===(u.id||u.uid);
    return `<div class="usuario-card">
      <div class="usuario-avatar" style="background:${rc.color}">${(u.nome||'?').charAt(0).toUpperCase()}</div>
      <div class="usuario-info"><div class="usuario-name">${u.nome||u.email}${isMe?' (você)':''}</div><div class="usuario-role">${u.email||''}</div></div>
      <span class="badge" style="background:${rc.bg};color:${rc.color};">${rc.label}</span>
      ${!isMe?`<button class="btn btn-xs" style="margin-left:auto;" onclick="abrirGerenciarUsuario('${u.id||u.uid}')">✏️ Editar</button>`:''}
    </div>`;
  }).join('')||'<div class="text-muted text-sm" style="padding:12px 0;">Nenhum usuário encontrado</div>';
}
 
// ════════════════════════════════════════════════
// NAVEGAÇÃO
// ════════════════════════════════════════════════
function goPage(name) {
  const rc=ROLE_CONFIG[STATE.currentUser?.role]||ROLE_CONFIG.garcom;
  if(!rc.pages.includes(name)){toast('Sem permissão','error');return;}
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn,.nav-mob-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  document.querySelectorAll(`[data-page="${name}"]`).forEach(b=>b.classList.add('active'));
  const renders={
    mesas:renderFloor,
    pedido:()=>{renderMesaSelector();renderCardapio();renderCart();},
    cozinha:renderKDS,
    caixa:renderCaixa,
    estoque:renderEstoque,
    cardapio:renderCardapioAdmin,
    relatorios:renderRelatorios,
    'relatorios-mensais':renderRelatoriosMensais,
    config:renderConfigPage,
  };
  renders[name]?.();
}
window.goPage=goPage;
 
function renderAll(){renderFloor();renderKDS();}
 
// ════════════════════════════════════════════════
// MODAIS
// ════════════════════════════════════════════════
window.openModal  =(id)=>document.getElementById(id).classList.add('open');
window.closeModal =(id)=>document.getElementById(id).classList.remove('open');
document.querySelectorAll('.modal-overlay').forEach(o=>{
  o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open');});
});
 
// ════════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════════
let toastTimer=null;
function toast(msg,type='success'){
  const t=document.getElementById('toast');
  t.textContent=msg; t.className=`toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),3500);
}
window.toast=toast;
 
// ════════════════════════════════════════════════
// EXPORTAR PDF
// ════════════════════════════════════════════════
window.exportarRelatorioPDF=async()=>{
  toast('Gerando relatório PDF...','info');
  try{
    if(!window.jspdf){
      await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});
    }
    const{jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const W=210,M=16;let y=0;
    const cor={roxo:[124,58,237],roxoClaro:[237,233,254],cinza:[100,100,100],cinzaClaro:[245,245,245],branco:[255,255,255],preto:[30,30,30],verde:[22,163,74],vermelho:[220,38,38],linha:[220,220,220]};
    const fmtN=v=>'R$ '+Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
    const addPage=()=>{doc.addPage();y=20;};
    const checkY=(n=20)=>{if(y+n>280)addPage();};
    doc.setFillColor(...cor.roxo);doc.rect(0,0,W,38,'F');
    doc.setFillColor(...cor.roxoClaro);doc.rect(0,38,W,2,'F');
    doc.setTextColor(...cor.branco);
    doc.setFontSize(22);doc.setFont('helvetica','bold');doc.text('RestaurantOS',M,16);
    doc.setFontSize(11);doc.setFont('helvetica','normal');doc.text('Relatório Gerencial Completo',M,24);
    doc.setFontSize(9);doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}   |   ${SYS.nomeRestaurante}`,M,32);
    y=50;
    const datas=Object.keys(DB.relatorio_dia).sort();
    const totFat=Object.values(DB.relatorio_dia).reduce((s,r)=>s+(r.faturamento||0),0);
    const totPed=Object.values(DB.relatorio_dia).reduce((s,r)=>s+(r.pedidos_total||0),0);
    const totIten=Object.values(DB.relatorio_dia).reduce((s,r)=>s+(r.itens_total||0),0);
    const ticketMedio=totPed>0?totFat/totPed:0;
    const drawSecTitle=(titulo)=>{checkY(14);doc.setFillColor(...cor.roxo);doc.roundedRect(M,y,W-M*2,9,2,2,'F');doc.setTextColor(...cor.branco);doc.setFontSize(10);doc.setFont('helvetica','bold');doc.text(titulo,M+4,y+6.2);y+=13;};
    const drawMetricCard=(label,value,x,w,dest=false)=>{doc.setFillColor(...(dest?cor.roxoClaro:cor.cinzaClaro));doc.roundedRect(x,y,w,18,2,2,'F');doc.setDrawColor(...cor.linha);doc.roundedRect(x,y,w,18,2,2,'S');doc.setTextColor(...cor.cinza);doc.setFontSize(7.5);doc.setFont('helvetica','normal');doc.text(label,x+4,y+6);doc.setTextColor(...(dest?cor.roxo:cor.preto));doc.setFontSize(11);doc.setFont('helvetica','bold');doc.text(value,x+4,y+14);};
    drawSecTitle('Resumo Geral');
    const cw=(W-M*2-9)/4;
    drawMetricCard('Faturamento Total',fmtN(totFat),M,cw,true);
    drawMetricCard('Total de Pedidos',String(totPed),M+cw+3,cw);
    drawMetricCard('Itens Vendidos',String(totIten),M+cw*2+6,cw);
    drawMetricCard('Ticket Médio',fmtN(ticketMedio),M+cw*3+9,cw);
    y+=24;
    if(datas.length){
      drawSecTitle('Faturamento por Dia');
      doc.setFillColor(...cor.roxoClaro);doc.rect(M,y,W-M*2,7,'F');
      doc.setTextColor(...cor.roxo);doc.setFontSize(8);doc.setFont('helvetica','bold');
      doc.text('Data',M+3,y+5);doc.text('Pedidos',M+55,y+5);doc.text('Itens',M+85,y+5);doc.text('Faturamento',M+115,y+5);y+=7;
      let alt=false;
      for(const d of datas.slice(-30)){
        checkY(7);const r=DB.relatorio_dia[d]||{};const[aa,mm,dd]=d.split('-');
        doc.setFillColor(...(alt?[250,248,255]:cor.branco));doc.rect(M,y,W-M*2,7,'F');
        doc.setTextColor(...cor.preto);doc.setFontSize(8);doc.setFont('helvetica','normal');
        doc.text(`${dd}/${mm}/${aa}`,M+3,y+5);doc.text(String(r.pedidos_total||0),M+55,y+5);doc.text(String(r.itens_total||0),M+85,y+5);
        doc.setFont('helvetica','bold');doc.text(fmtN(r.faturamento||0),M+115,y+5);
        doc.setDrawColor(...cor.linha);doc.line(M,y+7,W-M,y+7);y+=7;alt=!alt;
      }
      checkY(8);doc.setFillColor(...cor.roxo);doc.rect(M,y,W-M*2,8,'F');
      doc.setTextColor(...cor.branco);doc.setFontSize(8.5);doc.setFont('helvetica','bold');
      doc.text('TOTAL',M+3,y+5.5);doc.text(String(totPed),M+55,y+5.5);doc.text(String(totIten),M+85,y+5.5);doc.text(fmtN(totFat),M+115,y+5.5);y+=14;
    }
    const rankMap={};Object.values(DB.ranking_itens).forEach(r=>{if(!rankMap[r.nome])rankMap[r.nome]={nome:r.nome,qty:0,fat:0};rankMap[r.nome].qty+=r.qty||0;rankMap[r.nome].fat+=r.faturamento||0;});
    const rank=Object.values(rankMap).sort((a,b)=>b.qty-a.qty).slice(0,10);
    if(rank.length){
      checkY(60);drawSecTitle('Top 10 Itens Mais Vendidos');
      doc.setFillColor(...cor.roxoClaro);doc.rect(M,y,W-M*2,7,'F');
      doc.setTextColor(...cor.roxo);doc.setFontSize(8);doc.setFont('helvetica','bold');
      doc.text('#',M+3,y+5);doc.text('Item',M+12,y+5);doc.text('Qtd',M+110,y+5);doc.text('Faturamento',M+130,y+5);y+=7;
      rank.forEach((r,i)=>{checkY(7);doc.setFillColor(...(i%2===0?cor.branco:[250,248,255]));doc.rect(M,y,W-M*2,7,'F');doc.setTextColor(...(i<3?cor.roxo:cor.preto));doc.setFontSize(8);doc.setFont('helvetica',i<3?'bold':'normal');doc.text(String(i+1),M+3,y+5);doc.text(r.nome.length>38?r.nome.slice(0,36)+'…':r.nome,M+12,y+5);doc.text(String(r.qty),M+110,y+5);doc.setFont('helvetica','bold');doc.text(fmtN(r.fat),M+130,y+5);doc.setDrawColor(...cor.linha);doc.line(M,y+7,W-M,y+7);y+=7;});y+=6;
    }
    const pgtoMap={};Object.values(DB.fat_pgto).forEach(r=>{if(!pgtoMap[r.forma])pgtoMap[r.forma]={f:r.forma,v:0,q:0};pgtoMap[r.forma].v+=r.valor||0;pgtoMap[r.forma].q+=r.qtd||0;});
    const pgtos=Object.values(pgtoMap).sort((a,b)=>b.v-a.v);
    if(pgtos.length){
      checkY(50);drawSecTitle('Receita por Forma de Pagamento');
      doc.setFillColor(...cor.roxoClaro);doc.rect(M,y,W-M*2,7,'F');
      doc.setTextColor(...cor.roxo);doc.setFontSize(8);doc.setFont('helvetica','bold');
      doc.text('Forma',M+3,y+5);doc.text('Qtd',M+70,y+5);doc.text('Total',M+130,y+5);y+=7;
      const nomes2={dinheiro:'Dinheiro',debito:'Cartão Débito',credito:'Cartão Crédito',pix:'Pix'};
      pgtos.forEach((p,i)=>{checkY(7);doc.setFillColor(...(i%2===0?cor.branco:[250,248,255]));doc.rect(M,y,W-M*2,7,'F');doc.setTextColor(...cor.preto);doc.setFontSize(8);doc.setFont('helvetica','normal');doc.text(nomes2[p.f]||p.f,M+3,y+5);doc.text(String(p.q),M+70,y+5);doc.setFont('helvetica','bold');doc.text(fmtN(p.v),M+130,y+5);doc.setDrawColor(...cor.linha);doc.line(M,y+7,W-M,y+7);y+=7;});y+=6;
    }
    const estItens=Object.values(DB.estoque).sort((a,b)=>a.qty/a.max_qty-b.qty/b.max_qty);
    if(estItens.length){
      checkY(60);drawSecTitle('Status do Estoque');
      doc.setFillColor(...cor.roxoClaro);doc.rect(M,y,W-M*2,7,'F');
      doc.setTextColor(...cor.roxo);doc.setFontSize(8);doc.setFont('helvetica','bold');
      doc.text('Ingrediente',M+3,y+5);doc.text('Qtd Atual',M+80,y+5);doc.text('Máximo',M+110,y+5);doc.text('%',M+138,y+5);doc.text('Status',M+152,y+5);y+=7;
      estItens.forEach((v,i)=>{checkY(7);const pct2=Math.min(1,v.qty/v.max_qty);const status=pct2<0.2?'Crítico':pct2<0.4?'Baixo':'OK';const cor2=pct2<0.2?cor.vermelho:pct2<0.4?[217,119,6]:cor.verde;doc.setFillColor(...(i%2===0?cor.branco:[250,248,255]));doc.rect(M,y,W-M*2,7,'F');doc.setTextColor(...cor.preto);doc.setFontSize(8);doc.setFont('helvetica','normal');doc.text(v.nome,M+3,y+5);doc.text(`${Number(v.qty).toFixed(1)} ${v.unidade}`,M+80,y+5);doc.text(`${v.max_qty} ${v.unidade}`,M+110,y+5);doc.text(`${Math.round(pct2*100)}%`,M+138,y+5);doc.setTextColor(...cor2);doc.setFont('helvetica','bold');doc.text(status,M+152,y+5);doc.setDrawColor(...cor.linha);doc.line(M,y+7,W-M,y+7);y+=7;});y+=6;
    }
    const total_pages=doc.getNumberOfPages();
    for(let p=1;p<=total_pages;p++){doc.setPage(p);doc.setFillColor(...cor.cinzaClaro);doc.rect(0,289,W,8,'F');doc.setTextColor(...cor.cinza);doc.setFontSize(7);doc.setFont('helvetica','normal');doc.text(`RestaurantOS — Relatório Gerencial   |   ${new Date().toLocaleDateString('pt-BR')}`,M,294);doc.text(`Página ${p} de ${total_pages}`,W-M-20,294);}
    const nome=`relatorio_${SYS.nomeRestaurante.replace(/\s+/g,'_')}_${todayStr()}.pdf`;
    doc.save(nome);
    toast('Relatório PDF exportado!','success');
  }catch(e){console.error(e);toast('Erro ao gerar PDF','error');}
};
 
// ════════════════════════════════════════════════
// RELATÓRIOS MENSAIS
// ════════════════════════════════════════════════
const MESES_PT=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
function mesKey(ano,mes){return `${ano}-${String(mes+1).padStart(2,'0')}`;}
 
async function checkFecharMesAnterior(){
  const now=new Date();
  if(now.getDate()!==1) return;
  const mesAnt=new Date(now.getFullYear(),now.getMonth()-1,1);
  const key=mesKey(mesAnt.getFullYear(),mesAnt.getMonth());
  if(DB.relatorios_mensais[key]) return;
  await fecharMes(mesAnt.getFullYear(),mesAnt.getMonth());
}
 
async function fecharMes(ano,mes){
  const key=mesKey(ano,mes);
  if(DB.relatorios_mensais[key]){toast(`${MESES_PT[mes]}/${ano} já foi fechado.`,'info');return;}
  const prefixo1=`${ano}-${String(mes+1).padStart(2,'0')}-`;
  const prefixo2=`${ano}-${mes+1}-`;
  const pertence=d=>d.startsWith(prefixo1)||d.startsWith(prefixo2);
  const diasDoMes=Object.values(DB.relatorio_dia).filter(r=>pertence(r.id||r.data||''));
  const fat=diasDoMes.reduce((s,r)=>s+(r.faturamento||0),0);
  const ped=diasDoMes.reduce((s,r)=>s+(r.pedidos_total||0),0);
  const itens=diasDoMes.reduce((s,r)=>s+(r.itens_total||0),0);
  const rankMap={};Object.values(DB.ranking_itens).forEach(r=>{if(!pertence(r.data||''))return;if(!rankMap[r.nome])rankMap[r.nome]={nome:r.nome,cat:r.cat,qty:0,fat:0};rankMap[r.nome].qty+=r.qty||0;rankMap[r.nome].fat+=r.faturamento||0;});
  const pgtoMap={};Object.values(DB.fat_pgto).forEach(r=>{if(!pertence(r.data||''))return;if(!pgtoMap[r.forma])pgtoMap[r.forma]={forma:r.forma,valor:0,qtd:0};pgtoMap[r.forma].valor+=r.valor||0;pgtoMap[r.forma].qtd+=r.qtd||0;});
  const catMap={};Object.values(DB.fat_cat).forEach(r=>{if(!pertence(r.data||''))return;catMap[r.cat]=(catMap[r.cat]||0)+(r.valor||0);});
  const dados={ano,mes,key,nome:`${MESES_PT[mes]} ${ano}`,fechadoEm:Date.now(),faturamento:fat,pedidos_total:ped,itens_total:itens,ticket_medio:ped>0?fat/ped:0,dias:diasDoMes.map(d=>({data:d.id||d.data,faturamento:d.faturamento||0,pedidos:d.pedidos_total||0,itens:d.itens_total||0})).sort((a,b)=>a.data.localeCompare(b.data)),ranking:Object.values(rankMap).sort((a,b)=>b.qty-a.qty).slice(0,10),pgto:Object.values(pgtoMap),categorias:Object.entries(catMap).map(([c,v])=>({cat:c,valor:v})).sort((a,b)=>b.valor-a.valor)};
  await fsSet('relatorios_mensais',key,dados);
  DB.relatorios_mensais[key]={id:key,...dados};
  sysLog(`Relatório mensal ${MESES_PT[mes]}/${ano} gerado.`,'info');
  toast(`Relatório de ${MESES_PT[mes]}/${ano} salvo!`,'success');
}
 
window.fecharMesManual=async()=>{
  const now=new Date();
  if(!confirm(`Fechar e salvar o relatório de ${MESES_PT[now.getMonth()]} ${now.getFullYear()}?`)) return;
  await fecharMes(now.getFullYear(),now.getMonth());
  renderRelatoriosMensais();
};
 
function renderRelatoriosMensais(){
  if(!STATE.dbReady) return;
  const meses=Object.values(DB.relatorios_mensais).sort((a,b)=>b.key.localeCompare(a.key));
  const sub=document.getElementById('rm-sub'),lista=document.getElementById('rm-lista');
  if(!lista) return;
  if(!meses.length){if(sub)sub.textContent='Nenhum relatório gerado ainda.';lista.innerHTML=`<div class="card" style="text-align:center;padding:40px;color:var(--text3);">📅 Os relatórios são gerados automaticamente no início de cada mês.<br><br>Você pode fechar o mês atual pelo botão acima.</div>`;return;}
  if(sub)sub.textContent=`${meses.length} relatório(s) disponível(is)`;
  const aberto=STATE.mesMensalAberto;
  const pgtoIcone={dinheiro:'💵',debito:'💳',credito:'💳',pix:'📱'};
  lista.innerHTML=meses.map(m=>{
    const isAberto=aberto===m.key;
    const ticket=m.pedidos_total>0?m.faturamento/m.pedidos_total:0;
    const maxFat=Math.max(...(m.dias||[]).map(d=>d.faturamento),1);
    return `<div class="card mt-3">
      <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:4px 0;" onclick="toggleMesMensal('${m.key}')">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="font-size:28px;">📅</div>
          <div><div style="font-size:16px;font-weight:700;">${m.nome}</div><div style="font-size:12px;color:var(--text3);">Fechado em ${new Date(m.fechadoEm).toLocaleDateString('pt-BR')}</div></div>
        </div>
        <div style="display:flex;align-items:center;gap:16px;">
          <div style="text-align:right;"><div style="font-size:17px;font-weight:700;color:var(--green)">${fmtBRL(m.faturamento)}</div><div style="font-size:11px;color:var(--text3)">${m.pedidos_total} pedidos · ${m.itens_total} itens</div></div>
          <div style="display:flex;gap:6px;align-items:center;">
            <button class="btn btn-xs" onclick="event.stopPropagation();exportarMensalPDF('${m.key}')">📄 PDF</button>
            <span style="font-size:18px;color:var(--text3);transform:rotate(${isAberto?'180':'0'}deg);display:inline-block;transition:transform .2s;">▾</span>
          </div>
        </div>
      </div>
      ${isAberto?`
      <div class="divider"></div>
      <div class="g4" style="margin-bottom:16px;">
        <div class="metric-card text-center"><div class="metric-val">${fmtBRL(m.faturamento)}</div><div class="metric-label">Faturamento</div></div>
        <div class="metric-card text-center"><div class="metric-val">${m.pedidos_total}</div><div class="metric-label">Pedidos</div></div>
        <div class="metric-card text-center"><div class="metric-val">${fmtBRL(ticket)}</div><div class="metric-label">Ticket médio</div></div>
        <div class="metric-card text-center"><div class="metric-val">${m.itens_total}</div><div class="metric-label">Itens vendidos</div></div>
      </div>
      <div class="card-title" style="margin-bottom:10px;">Faturamento por dia</div>
      <div class="chart-bar-container" style="height:90px;">${(m.dias||[]).map(d=>{const pct=Math.max(4,Math.round(d.faturamento/maxFat*100));const v=d.faturamento>=1000?(d.faturamento/1000).toFixed(1)+'k':Math.round(d.faturamento);return`<div class="chart-bar-col"><div class="chart-bar-val">${v}</div><div class="chart-bar-rect" style="height:${pct}px"></div></div>`;}).join('')}</div>
      <div class="chart-bar-labels">${(m.dias||[]).map(d=>{const p=d.data.split('-');return`<span class="chart-bar-label">${p[2]||d.data}</span>`;}).join('')}</div>
      <div class="g2 mt-3">
        <div>
          <div class="card-title" style="margin-bottom:10px;">Top itens</div>
          ${(m.ranking||[]).slice(0,8).map((r,i)=>{const mx=m.ranking[0]?.qty||1;return`<div class="rank-item"><div class="rank-pos">${i+1}</div><div class="rank-name">${r.nome}</div><div class="rank-bar-wrap"><div class="rank-bar" style="width:${Math.round(r.qty/mx*100)}%"></div></div><div class="rank-qty">${r.qty}</div></div>`;}).join('')||'<div class="text-muted text-sm">Sem dados</div>'}
        </div>
        <div>
          <div class="card-title" style="margin-bottom:10px;">Por pagamento</div>
          ${(m.pgto||[]).sort((a,b)=>b.valor-a.valor).map(p=>`<div class="conta-total-row" style="padding:6px 0;"><span>${pgtoIcone[p.forma]||'💳'} ${p.forma} (${p.qtd}×)</span><span style="font-weight:700;">${fmtBRL(p.valor)}</span></div>`).join('')||'<div class="text-muted text-sm">Sem dados</div>'}
          <div class="card-title" style="margin-top:14px;margin-bottom:10px;">Por categoria</div>
          ${(m.categorias||[]).map(c=>{const mx=m.categorias[0]?.valor||1;return`<div class="rank-item"><div class="rank-name">${c.cat}</div><div class="rank-bar-wrap"><div class="rank-bar" style="width:${Math.round(c.valor/mx*100)}%;background:var(--brand-m)"></div></div><div class="rank-qty">${fmtBRL(c.valor)}</div></div>`;}).join('')||'<div class="text-muted text-sm">Sem dados</div>'}
        </div>
      </div>`:''}
    </div>`;
  }).join('');
}
 
window.toggleMesMensal=(key)=>{STATE.mesMensalAberto=STATE.mesMensalAberto===key?null:key;renderRelatoriosMensais();};
 
window.exportarMensalPDF=async(key)=>{
  const m=DB.relatorios_mensais[key];if(!m)return;
  toast('Gerando PDF...','info');
  try{
    if(!window.jspdf){await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});}
    const{jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const W=210,M=16;let y=0;
    const cor={roxo:[124,58,237],roxoClaro:[237,233,254],cinza:[100,100,100],cinzaClaro:[245,245,245],branco:[255,255,255],preto:[30,30,30],verde:[22,163,74],linha:[220,220,220]};
    const fmtN=v=>'R$ '+Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
    const addPage=()=>{doc.addPage();y=20;};
    const checkY=(n=20)=>{if(y+n>280)addPage();};
    const secTitle=t=>{checkY(14);doc.setFillColor(...cor.roxo);doc.roundedRect(M,y,W-M*2,9,2,2,'F');doc.setTextColor(...cor.branco);doc.setFontSize(10);doc.setFont('helvetica','bold');doc.text(t,M+4,y+6.2);y+=13;};
    doc.setFillColor(...cor.roxo);doc.rect(0,0,W,38,'F');doc.setFillColor(...cor.roxoClaro);doc.rect(0,38,W,2,'F');
    doc.setTextColor(...cor.branco);doc.setFontSize(20);doc.setFont('helvetica','bold');doc.text('RestaurantOS',M,15);
    doc.setFontSize(13);doc.setFont('helvetica','normal');doc.text(`Relatório Mensal — ${m.nome}`,M,25);
    doc.setFontSize(9);doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}   |   ${SYS.nomeRestaurante}`,M,33);
    y=50;
    secTitle('Resumo do Mês');
    const ticket=m.pedidos_total>0?m.faturamento/m.pedidos_total:0;
    const cw=(W-M*2-9)/4;
    const drawCard=(label,val,x,w,dest=false)=>{doc.setFillColor(...(dest?cor.roxoClaro:cor.cinzaClaro));doc.roundedRect(x,y,w,18,2,2,'F');doc.setDrawColor(...cor.linha);doc.roundedRect(x,y,w,18,2,2,'S');doc.setTextColor(...cor.cinza);doc.setFontSize(7.5);doc.setFont('helvetica','normal');doc.text(label,x+4,y+6);doc.setTextColor(...(dest?cor.roxo:cor.preto));doc.setFontSize(11);doc.setFont('helvetica','bold');doc.text(val,x+4,y+14);};
    drawCard('Faturamento Total',fmtN(m.faturamento),M,cw,true);drawCard('Pedidos',String(m.pedidos_total),M+cw+3,cw);drawCard('Itens Vendidos',String(m.itens_total),M+cw*2+6,cw);drawCard('Ticket Médio',fmtN(ticket),M+cw*3+9,cw);y+=24;
    if((m.dias||[]).length){secTitle('Faturamento por Dia');doc.setFillColor(...cor.roxoClaro);doc.rect(M,y,W-M*2,7,'F');doc.setTextColor(...cor.roxo);doc.setFontSize(8);doc.setFont('helvetica','bold');doc.text('Data',M+3,y+5);doc.text('Pedidos',M+60,y+5);doc.text('Itens',M+90,y+5);doc.text('Faturamento',M+120,y+5);y+=7;m.dias.forEach((d,i)=>{checkY(7);const parts=d.data.split('-');doc.setFillColor(...(i%2===0?cor.branco:[250,248,255]));doc.rect(M,y,W-M*2,7,'F');doc.setTextColor(...cor.preto);doc.setFontSize(8);doc.setFont('helvetica','normal');doc.text(`${parts[2]||''}/${parts[1]||''}/${parts[0]||''}`,M+3,y+5);doc.text(String(d.pedidos||0),M+60,y+5);doc.text(String(d.itens||0),M+90,y+5);doc.setFont('helvetica','bold');doc.text(fmtN(d.faturamento),M+120,y+5);doc.setDrawColor(...cor.linha);doc.line(M,y+7,W-M,y+7);y+=7;});y+=8;}
    if((m.ranking||[]).length){secTitle('Top Itens Vendidos');doc.setFillColor(...cor.roxoClaro);doc.rect(M,y,W-M*2,7,'F');doc.setTextColor(...cor.roxo);doc.setFontSize(8);doc.setFont('helvetica','bold');doc.text('#',M+3,y+5);doc.text('Item',M+12,y+5);doc.text('Qtd',M+115,y+5);doc.text('Faturamento',M+135,y+5);y+=7;m.ranking.forEach((r,i)=>{checkY(7);doc.setFillColor(...(i%2===0?cor.branco:[250,248,255]));doc.rect(M,y,W-M*2,7,'F');doc.setTextColor(...(i<3?cor.roxo:cor.preto));doc.setFontSize(8);doc.setFont('helvetica',i<3?'bold':'normal');doc.text(String(i+1),M+3,y+5);doc.text(r.nome.length>38?r.nome.slice(0,36)+'…':r.nome,M+12,y+5);doc.text(String(r.qty),M+115,y+5);doc.setFont('helvetica','bold');doc.text(fmtN(r.fat),M+135,y+5);doc.setDrawColor(...cor.linha);doc.line(M,y+7,W-M,y+7);y+=7;});y+=8;}
    if((m.pgto||[]).length){secTitle('Receita por Pagamento');const pgtoNomes={dinheiro:'Dinheiro',debito:'Cartão Débito',credito:'Cartão Crédito',pix:'Pix'};doc.setFillColor(...cor.roxoClaro);doc.rect(M,y,W-M*2,7,'F');doc.setTextColor(...cor.roxo);doc.setFontSize(8);doc.setFont('helvetica','bold');doc.text('Forma',M+3,y+5);doc.text('Qtd',M+80,y+5);doc.text('Total',M+120,y+5);y+=7;m.pgto.sort((a,b)=>b.valor-a.valor).forEach((p,i)=>{checkY(7);doc.setFillColor(...(i%2===0?cor.branco:[250,248,255]));doc.rect(M,y,W-M*2,7,'F');doc.setTextColor(...cor.preto);doc.setFontSize(8);doc.setFont('helvetica','normal');doc.text(pgtoNomes[p.forma]||p.forma,M+3,y+5);doc.text(String(p.qtd||0),M+80,y+5);doc.setFont('helvetica','bold');doc.text(fmtN(p.valor),M+120,y+5);doc.setDrawColor(...cor.linha);doc.line(M,y+7,W-M,y+7);y+=7;});}
    const tp=doc.getNumberOfPages();for(let p=1;p<=tp;p++){doc.setPage(p);doc.setFillColor(...cor.cinzaClaro);doc.rect(0,289,W,8,'F');doc.setTextColor(...cor.cinza);doc.setFontSize(7);doc.setFont('helvetica','normal');doc.text(`RestaurantOS — ${m.nome}   |   ${new Date().toLocaleDateString('pt-BR')}`,M,294);doc.text(`Página ${p} de ${tp}`,W-M-20,294);}
    doc.save(`relatorio_${m.nome.replace(/\s+/g,'_')}.pdf`);
    toast('PDF exportado!','success');
  }catch(e){console.error(e);toast('Erro ao gerar PDF','error');}
};
 
// ════════════════════════════════════════════════
// GESTÃO DE USUÁRIOS
// ════════════════════════════════════════════════
let _usuarioEditStatus=true;
window.abrirGerenciarUsuario=(uid)=>{
  const u=DB.usuarios[uid];if(!u)return;
  document.getElementById('usuario-edit-uid').value=uid;
  document.getElementById('modal-usuario-title').textContent=`Gerenciar: ${u.nome||u.email}`;
  STATE.usuarioEditRole=u.role||'garcom';
  _usuarioEditStatus=u.ativo!==false;
  document.querySelectorAll('#modal-gerenciar-usuario .login-role-btn').forEach(b=>b.classList.toggle('sel',b.dataset.role===STATE.usuarioEditRole));
  atualizarBotoesStatus();
  openModal('modal-gerenciar-usuario');
};
window.selRoleUsuario=(btn)=>{document.querySelectorAll('#modal-gerenciar-usuario .login-role-btn').forEach(b=>b.classList.remove('sel'));btn.classList.add('sel');STATE.usuarioEditRole=btn.dataset.role;};
window.setStatusUsuario=(ativo)=>{_usuarioEditStatus=ativo;atualizarBotoesStatus();};
function atualizarBotoesStatus(){
  const a=document.getElementById('btn-ativar-usuario'),d=document.getElementById('btn-desativar-usuario');
  if(!a||!d)return;
  a.style.opacity=_usuarioEditStatus?'1':'0.45';
  d.style.opacity=_usuarioEditStatus?'0.45':'1';
}
window.salvarUsuario=async()=>{
  const uid=document.getElementById('usuario-edit-uid').value;if(!uid)return;
  const upd={role:STATE.usuarioEditRole,ativo:_usuarioEditStatus};
  await fsUpd('usuarios',uid,upd);
  DB.usuarios[uid]={...DB.usuarios[uid],...upd};
  closeModal('modal-gerenciar-usuario');
  renderConfigPage();
  toast('Usuário atualizado!','success');
  sysLog(`Usuário ${DB.usuarios[uid]?.nome||uid} → ${STATE.usuarioEditRole}, ativo:${_usuarioEditStatus}`);
};
 
// ════════════════════════════════════════════════
// ALERTAS SONOROS KDS — FIX: contexto de áudio inicializado corretamente
// ════════════════════════════════════════════════
let _somKDSMuted=false;
let _audioCtx=null;
 
// FIX: inicializa AudioContext com interação do usuário
function ensureAudioCtx(){
  if(!_audioCtx) _audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  if(_audioCtx.state==='suspended') _audioCtx.resume();
}
document.addEventListener('click',()=>ensureAudioCtx(),{once:false});
document.addEventListener('touchstart',()=>ensureAudioCtx(),{once:false});
 
window.toggleSomKDS=()=>{
  _somKDSMuted=!_somKDSMuted;
  const btn=document.getElementById('btn-som-kds');
  if(btn){btn.textContent=_somKDSMuted?'🔕 Mudo':'🔔 Som';}
  toast(_somKDSMuted?'Alerta sonoro desativado':'Alerta sonoro ativado','info');
};
 
function tocarAlertaKDS(){
  if(_somKDSMuted) return;
  try{
    ensureAudioCtx();
    const ctx=_audioCtx;
    const play=(freq,start,dur)=>{
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.connect(gain);gain.connect(ctx.destination);
      osc.frequency.value=freq;osc.type='sine';
      gain.gain.setValueAtTime(0.35,ctx.currentTime+start);
      gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+start+dur);
      osc.start(ctx.currentTime+start);osc.stop(ctx.currentTime+start+dur+0.05);
    };
    // 3 bips ascendentes para novo pedido
    play(660,0,0.1);play(880,0.12,0.1);play(1100,0.24,0.18);
  }catch(e){console.warn('AudioContext error:',e);}
}
 
// ════════════════════════════════════════════════
// TEMA CLARO / ESCURO
// ════════════════════════════════════════════════
function aplicarTema(claro){
  document.body.classList.toggle('tema-claro', claro);
  const icon = claro ? '☀️' : '🌙';
  const label = claro ? 'Tema claro' : 'Tema escuro';
  const labelShort = claro ? 'Claro' : 'Escuro';
  const ids = ['tema-icon','tema-icon-login','tema-icon-cfg'];
  ids.forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=icon; });
  const el3 = document.getElementById('tema-label-login'); if(el3) el3.textContent=label;
  const el4 = document.getElementById('tema-label-cfg'); if(el4) el4.textContent=labelShort;
}
window.toggleTema = () => {
  const claro = !document.body.classList.contains('tema-claro');
  aplicarTema(claro);
  try { localStorage.setItem('restaurantOS_tema', claro ? 'claro' : 'escuro'); } catch(e){}
};
// Aplica tema salvo ao carregar
(()=>{ try{ const t=localStorage.getItem('restaurantOS_tema'); if(t==='claro') aplicarTema(true); }catch(e){} })();
 
// ════════════════════════════════════════════════
// CLOCK + AUTO-REFRESH
// ════════════════════════════════════════════════
function updateClock(){
  const n=new Date();
  document.getElementById('clock').textContent=String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');
}
 
updateClock();
setInterval(updateClock,30000);
setInterval(()=>{
  if(!STATE.dbReady) return;
  checkNightReset();
  const ap=document.querySelector('.page.active')?.id;
  if(ap==='page-mesas')   renderFloor();
  if(ap==='page-cozinha') renderKDS();
  if(ap==='page-caixa')   renderCaixa();
},SYS.autoRefreshMs);