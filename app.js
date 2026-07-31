const $ = id => document.getElementById(id);
const form = $('contractForm');
const servicesList = $('servicesList');
const serviceTemplate = $('serviceTemplate');
const STORAGE_KEY = 'brinky_contracts_v1';
const APP_VERSION='6.0';
const QUOTES_KEY='brinky_quotes_v1';
const EXPENSES_KEY='brinky_expenses_v1';
const LOYALTY_KEY='brinky_loyalty_v1';
const LOYALTY_SETTINGS_KEY='brinky_loyalty_settings_v1';
const MESSAGES_KEY='brinky_messages_v1';
const COMPANY = {
  name:'BRINKY FIESTA',
  address:'Calle 13 x 18 y 20, Col. Centro, Umán, Yucatán',
  whatsapp:'999 447 6314',
  facebook:'Brincolines Brinky Fiesta'
};
let deferredPrompt;
let previewIsNewContract = false;
let currentPreviewData = null;

function contractId(){
  const now = new Date();
  const y = now.getFullYear();
  const existing = getContracts().map(c => String(c.id || '')).filter(id => id.startsWith(`BF-${y}-`));
  const highest = existing.reduce((max, id) => {
    const n = Number(id.split('-').pop()) || 0;
    return Math.max(max, n);
  }, 0);
  return `BF-${y}-${String(highest + 1).padStart(6,'0')}`;
}

function addService(data={}){
  const row = serviceTemplate.content.firstElementChild.cloneNode(true);
  const select=row.querySelector('.service-name');
  const custom=row.querySelector('.service-custom');
  const names=[...select.options].map(o=>o.value);
  const requestedName=Object.prototype.hasOwnProperty.call(data,'name') ? String(data.name || '') : '';
  if(requestedName && !names.includes(requestedName)){
    select.value='OTRO';
    custom.value=requestedName;
    custom.classList.remove('hidden');
  }else{
    select.value=requestedName;
  }
  const syncCustom=()=>custom.classList.toggle('hidden',select.value!=='OTRO');
  select.addEventListener('change',()=>{syncCustom();updateServiceAvailability();});
  syncCustom();
  row.querySelector('.service-qty').value = data.qty || 1;
  row.querySelector('.service-duration').value = data.duration || '4';
  row.querySelector('.service-price').value = data.price || 0;
  row.querySelector('.remove-service').addEventListener('click',()=>{row.remove();recalculateTotal();});
  row.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',recalculateTotal));
  servicesList.appendChild(row);
  updateServiceAvailability();
}

function getServices(){
  return [...servicesList.querySelectorAll('.service-row')].map(row=>({
    name:row.querySelector('.service-name').value==='OTRO' ? (row.querySelector('.service-custom').value.trim() || 'OTRO') : row.querySelector('.service-name').value,
    qty:Number(row.querySelector('.service-qty').value||0),
    duration:row.querySelector('.service-duration').value,
    durationLabel:row.querySelector('.service-duration').selectedOptions[0].textContent,
    price:Number(row.querySelector('.service-price').value||0)
  }));
}

function recalculateTotal(){
  const subtotal = getServices().reduce((sum,s)=>sum+s.price,0);
  const discount = Math.max(0, Number($('discount')?.value||0));
  const total = Math.max(0, subtotal-discount);
  $('subtotal').value = subtotal.toFixed(2);
  $('total').value = total.toFixed(2);
  recalculateBalance();
}
function recalculateBalance(){
  const total=Number($('total').value||0),dep=Math.max(0,Number($('deposit').value||0));
  $('balance').value=Math.max(0,total-dep).toFixed(2);
}

function collectData(){
  return {
    id:$('contractNumber').textContent,
    createdAt:new Date().toISOString(),
    clientName:$('clientName').value.trim(),clientPhone:$('clientPhone').value.trim(),
    eventAddress:$('eventAddress').value.trim(),mapsLink:$('mapsLink').value.trim(),
    eventDate:$('eventDate').value,eventType:$('eventType').value,startTime:$('startTime').value,
    endTime:$('endTime').value,installTime:$('installTime').value,pickupTime:$('pickupTime').value,
    childrenCount:$('childrenCount').value,electricity:$('electricity').value,
    services:getServices(),subtotal:Number($('subtotal').value||0),discount:Number($('discount').value||0),discountReason:$('discountReason').value.trim(),total:Number($('total').value||0),deposit:Number($('deposit').value||0),
    balance:Number($('balance').value||0),paymentMethod:$('paymentMethod').value,notes:$('notes').value.trim(),
    signature:$('signatureCanvas').toDataURL('image/png')
  };
}

function getContracts(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||[]}catch{return []}}

function getExpenses(){try{return JSON.parse(localStorage.getItem(EXPENSES_KEY))||[]}catch{return []}}
function setExpenses(items){localStorage.setItem(EXPENSES_KEY,JSON.stringify(items));renderReports()}
function monthKey(date=''){return String(date||'').slice(0,7)}
function selectedReportKey(){return `${$('reportYear').value}-${String($('reportMonth').value).padStart(2,'0')}`}
function initReportFilters(){
  const months=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  $('reportMonth').innerHTML=months.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('');
  const years=new Set([new Date().getFullYear()]);
  getContracts().forEach(c=>c.eventDate&&years.add(Number(c.eventDate.slice(0,4))));
  getExpenses().forEach(e=>e.date&&years.add(Number(e.date.slice(0,4))));
  const list=[...years].filter(Boolean).sort((a,b)=>b-a);
  $('reportYear').innerHTML=list.map(y=>`<option>${y}</option>`).join('');
  const now=new Date();$('reportMonth').value=String(now.getMonth()+1);$('reportYear').value=String(now.getFullYear());
  $('expenseDate').value=new Date().toISOString().slice(0,10);
}
function renderReports(){
  if(!$('reportMonth')||!$('reportYear')||!$('reportMonth').value)return;
  const key=selectedReportKey();
  const contracts=getContracts().filter(c=>monthKey(c.eventDate)===key);
  const expenses=getExpenses().filter(e=>monthKey(e.date)===key);
  const sales=contracts.reduce((s,c)=>s+Number(c.total||0),0);
  const pending=contracts.reduce((s,c)=>s+Number(c.balance||0),0);
  const collected=contracts.reduce((s,c)=>s+Math.max(0,Number(c.total||0)-Number(c.balance||0)),0);
  const expenseTotal=expenses.reduce((s,e)=>s+Number(e.amount||0),0);
  const profit=collected-expenseTotal;
  $('reportContractsCount').textContent=contracts.length;
  $('reportSales').textContent=money(sales);$('reportCollected').textContent=money(collected);
  $('reportPending').textContent=money(pending);$('reportExpenses').textContent=money(expenseTotal);
  $('reportProfit').textContent=money(profit);$('reportProfit').classList.toggle('negative',profit<0);
  $('monthlyContracts').innerHTML=contracts.length?contracts.sort((a,b)=>(a.eventDate||'').localeCompare(b.eventDate||'')).map(c=>`<div class="report-row"><div><strong>${escapeHtml(c.clientName||'Sin nombre')}</strong><div class="saved-meta">${c.id} · ${dateFmt(c.eventDate)} · ${escapeHtml((c.services&&c.services[0]?.name)||'Servicio')}</div></div><div class="report-money"><b>${money(c.total)}</b><small>Pendiente: ${money(c.balance)}</small></div></div>`).join(''):'<div class="empty">No hay contratos en este mes.</div>';
  $('expensesList').innerHTML=expenses.length?expenses.sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(e=>`<div class="report-row"><div><strong>${escapeHtml(e.category)}</strong><div class="saved-meta">${dateFmt(e.date)} · ${escapeHtml(e.description||'Sin descripción')}</div></div><div class="expense-actions"><b>${money(e.amount)}</b><button class="btn btn-danger-light" onclick="deleteExpense('${e.id}')">Eliminar</button></div></div>`).join(''):'<div class="empty">No hay gastos registrados en este mes.</div>';
  const counts={};contracts.forEach(c=>(c.services||[]).forEach(s=>{const n=s.name||'Sin nombre';counts[n]=(counts[n]||0)+Number(s.qty||1)}));
  const top=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8);
  $('topServices').innerHTML=top.length?top.map(([name,count],i)=>`<div class="service-rank"><span>${i+1}</span><div><strong>${escapeHtml(name)}</strong><small>${count} renta${count===1?'':'s'}</small></div></div>`).join(''):'<div class="empty">Aún no hay servicios registrados en este mes.</div>';
}
window.deleteExpense=id=>{if(confirm('¿Eliminar este gasto?'))setExpenses(getExpenses().filter(e=>e.id!==id))};

function setContracts(items){localStorage.setItem(STORAGE_KEY,JSON.stringify(items));renderSaved();renderDashboard();updateServiceAvailability();renderReports()}
function saveContract(data){const items=getContracts();const i=items.findIndex(x=>x.id===data.id);if(i>=0)items[i]=data;else items.unshift(data);setContracts(items)}

// Servicios consumibles que no representan un equipo único y, por tanto,
// no bloquean un horario en la agenda.
function isReservableEquipment(serviceName=''){
  const name=String(serviceName).trim().toUpperCase();
  return name && !name.startsWith('PREMIOS ');
}

function timeToMinutes(value=''){
  const parts=String(value).split(':').map(Number);
  if(parts.length!==2 || parts.some(Number.isNaN)) return null;
  return parts[0]*60+parts[1];
}

function normalizeEquipmentName(value=''){
  return String(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,' ').trim().toUpperCase();
}

function getEquipmentReservation(serviceName, eventDate, startTime, endTime, excludeId=''){
  if(!isReservableEquipment(serviceName) || !eventDate) return null;
  const start=timeToMinutes(startTime), end=timeToMinutes(endTime);
  if(start===null || end===null || start>=end) return null;
  const wanted=normalizeEquipmentName(serviceName);
  for(const saved of getContracts()){
    if(saved.id===excludeId || saved.eventDate!==eventDate) continue;
    const savedStart=timeToMinutes(saved.startTime), savedEnd=timeToMinutes(saved.endTime);
    if(savedStart===null || savedEnd===null) continue;
    if(!(start < savedEnd && end > savedStart)) continue;
    const match=(saved.services||[]).find(s=>isReservableEquipment(s.name) && normalizeEquipmentName(s.name)===wanted);
    if(match) return {contract:saved, service:match};
  }
  return null;
}

function updateServiceAvailability(){
  const eventDate=$('eventDate')?.value || '';
  const startTime=$('startTime')?.value || '';
  const endTime=$('endTime')?.value || '';
  const excludeId=$('contractNumber')?.textContent || '';
  const validRange=timeToMinutes(startTime)!==null && timeToMinutes(endTime)!==null && timeToMinutes(startTime)<timeToMinutes(endTime);

  servicesList.querySelectorAll('.service-row').forEach(row=>{
    const select=row.querySelector('.service-name');
    const status=row.querySelector('.service-status');
    const previous=select.value;
    let selectedConflict=null;

    [...select.options].forEach(option=>{
      if(!option.dataset.baseLabel) option.dataset.baseLabel=option.textContent.replace(/\s+—\s+NO DISPONIBLE.*$/,'');
      const base=option.dataset.baseLabel;
      option.value=base;
      option.textContent=base;
      option.disabled=false;
      option.classList.remove('option-unavailable');
      if(base==='OTRO' || !isReservableEquipment(base) || !eventDate || !validRange) return;
      const conflict=getEquipmentReservation(base,eventDate,startTime,endTime,excludeId);
      if(conflict){
        option.disabled=true;
        option.classList.add('option-unavailable');
        option.textContent=`${base} — NO DISPONIBLE (${conflict.contract.startTime}–${conflict.contract.endTime})`;
        if(base===previous) selectedConflict=conflict;
      }
    });

    if(selectedConflict){
      const firstAvailable=[...select.options].find(o=>!o.disabled && o.value!=='');
      if(firstAvailable) select.value=firstAvailable.value;
      row.classList.add('service-row-warning');
      status.classList.remove('hidden');
      status.textContent=`Se retiró el equipo ocupado. Reservado para ${selectedConflict.contract.clientName || 'otro cliente'} de ${selectedConflict.contract.startTime} a ${selectedConflict.contract.endTime}.`;
      row.querySelector('.service-custom').classList.add('hidden');
    }else{
      row.classList.remove('service-row-warning');
      status.classList.add('hidden');
      status.textContent='';
    }
  });
  recalculateTotal();
}

function findReservationConflict(data){
  const start=timeToMinutes(data.startTime);
  const end=timeToMinutes(data.endTime);
  if(start===null || end===null || start>=end){
    return {type:'invalid-time'};
  }

  const selected=(data.services||[])
    .filter(s=>isReservableEquipment(s.name))
    .map(s=>normalizeEquipmentName(s.name));
  if(!selected.length) return null;
  const duplicate=selected.find((name,index)=>selected.indexOf(name)!==index);
  if(duplicate){
    const original=(data.services||[]).find(s=>normalizeEquipmentName(s.name)===duplicate);
    return {type:'duplicate-equipment', equipment:original?.name || duplicate};
  }

  for(const saved of getContracts()){
    // Permite volver a guardar el mismo folio sin considerarlo un conflicto consigo mismo.
    if(saved.id===data.id) continue;
    if(saved.eventDate!==data.eventDate) continue;

    const savedStart=timeToMinutes(saved.startTime);
    const savedEnd=timeToMinutes(saved.endTime);
    if(savedStart===null || savedEnd===null) continue;

    // Hay traslape cuando cada reserva comienza antes de que termine la otra.
    // Si una termina exactamente cuando inicia la siguiente, sí se permite.
    const overlaps=start < savedEnd && end > savedStart;
    if(!overlaps) continue;

    for(const service of (saved.services||[])){
      if(!isReservableEquipment(service.name)) continue;
      const normalized=normalizeEquipmentName(service.name);
      if(selected.includes(normalized)){
        return {type:'equipment', equipment:service.name, contract:saved};
      }
    }
  }
  return null;
}

function validateAvailability(data){
  const conflict=findReservationConflict(data);
  if(!conflict) return true;

  if(conflict.type==='invalid-time'){
    alert('⚠️ Horario incorrecto\n\nLa hora de finalización debe ser posterior a la hora de inicio.');
    return false;
  }
  if(conflict.type==='duplicate-equipment'){
    alert('⚠️ EQUIPO REPETIDO\n\nEl equipo '+conflict.equipment+' aparece más de una vez en este contrato. Elimínalo o selecciona otro servicio.');
    return false;
  }

  const c=conflict.contract;
  alert(
    '⚠️ EQUIPO NO DISPONIBLE\n\n' +
    'El equipo seleccionado ya está reservado en un horario que se traslapa.\n\n' +
    'Equipo: ' + conflict.equipment + '\n' +
    'Cliente: ' + (c.clientName || 'Sin nombre') + '\n' +
    'Contrato: ' + (c.id || 'Sin folio') + '\n' +
    'Fecha: ' + dateFmt(c.eventDate) + '\n' +
    'Horario reservado: ' + (c.startTime || '—') + ' a ' + (c.endTime || '—') + '\n\n' +
    'Selecciona otro equipo o modifica el horario.'
  );
  return false;
}
const money = n => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n||0);
const dateFmt = s => s ? new Date(`${s}T12:00:00`).toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'}) : '';

function renderPreview(d){
  currentPreviewData = d;
  const rows=d.services.map(s=>`<tr><td>${escapeHtml(s.name)}</td><td>${s.qty}</td><td>${escapeHtml(s.durationLabel)}</td><td class="money">${money(s.price)}</td></tr>`).join('');
  $('contractPreview').innerHTML=`
    <div class="contract-header"><h1>${COMPANY.name}</h1><div>Renta de brincolines y mobiliario para fiestas infantiles</div><div class="company-data">${COMPANY.address}<br>WhatsApp: ${COMPANY.whatsapp}<br>Facebook: ${COMPANY.facebook}</div><strong>${d.id}</strong></div>
    <div class="contract-grid">
      <div><strong>Cliente:</strong> ${escapeHtml(d.clientName)}</div><div><strong>Teléfono:</strong> ${escapeHtml(d.clientPhone)}</div>
      <div><strong>Fecha del evento:</strong> ${dateFmt(d.eventDate)}</div><div><strong>Tipo de evento:</strong> ${escapeHtml(d.eventType)}</div>
      <div><strong>Horario:</strong> ${d.startTime} a ${d.endTime}</div><div><strong>Instalación / retiro:</strong> ${d.installTime||'—'} / ${d.pickupTime||'—'}</div>
      <div style="grid-column:1/-1"><strong>Dirección:</strong> ${escapeHtml(d.eventAddress)}</div>
    </div>
    <table><thead><tr><th>Servicio</th><th>Cantidad</th><th>Tiempo</th><th>Precio</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="contract-grid"><div><strong>Subtotal:</strong> ${money(d.subtotal ?? (Number(d.total||0)+Number(d.discount||0)))}</div><div><strong>Descuento:</strong> ${money(d.discount||0)}</div>${d.discountReason?`<div style="grid-column:1/-1"><strong>Razón del descuento:</strong> ${escapeHtml(d.discountReason)}</div>`:''}<div><strong>Total:</strong> ${money(d.total)}</div><div><strong>Anticipo:</strong> ${money(d.deposit)}</div><div><strong>Saldo:</strong> ${money(d.balance)}</div><div><strong>Forma de pago:</strong> ${escapeHtml(d.paymentMethod)}</div></div>
    <h3>Cláusulas del servicio</h3>
    <ol class="contract-clauses">
      <li>El cliente se compromete a proporcionar un espacio adecuado y seguro para la instalación del equipo.</li>
      <li>El cliente será responsable de cualquier daño ocasionado por mal uso, objetos punzocortantes, fuego, líquidos, mascotas o negligencia durante el periodo de renta.</li>
      <li>En caso de lluvia, fuertes vientos o cualquier condición climática que represente un riesgo para los usuarios o el equipo, Brinky Fiesta podrá suspender o cancelar el servicio.</li>
      <li>El equipo permanecerá instalado únicamente durante el horario contratado.</li>
      <li><strong>El total del costo del servicio deberá quedar liquidado el día del evento, antes de la instalación del equipo.</strong></li>
      <li>El anticipo entregado garantiza la reserva de la fecha y no será reembolsable en caso de cancelación por parte del cliente dentro de las 24 horas previas al evento.</li>
      <li>El cliente deberá proporcionar una toma de corriente eléctrica de 127 V en buen estado y a una distancia no mayor de 20 metros del lugar de instalación, salvo que se haya contratado otro servicio.</li>
      <li>El cliente será responsable del equipo desde el momento de la instalación hasta que sea retirado por personal de Brinky Fiesta.</li>
      <li>No se permitirá el uso del equipo sin la supervisión de un adulto responsable.</li>
      <li>El cliente manifiesta haber leído y aceptado todas las condiciones del presente contrato.</li>
    </ol>
    ${d.notes?`<p><strong>Observaciones:</strong> ${escapeHtml(d.notes)}</p>`:''}
    <div class="client-signature-block"><img class="signature-img" src="${d.signature}" alt="Firma del cliente"><div class="signature-label">Firma del cliente</div><div class="signature-name">${escapeHtml(d.clientName)}</div><div class="signature-date">Fecha: ${new Date().toLocaleDateString('es-MX')}</div></div>
    <section class="facebook-cta">
      <img src="assets/facebook-banner.jpg" alt="Brincolines Brinky Fiesta en Facebook">
      <div class="facebook-cta-copy">
        <h3>¿Disfrutaste nuestro servicio?</h3>
        <p>Tu recomendación nos ayuda a que más familias conozcan Brinky Fiesta. Visita nuestra página <strong>Brincolines Brinky Fiesta</strong> y déjanos una buena referencia.</p>
        <a href="https://www.facebook.com/search/top?q=Brincolines%20Brinky%20Fiesta" target="_blank" rel="noopener">Abrir nuestra página de Facebook</a>
      </div>
    </section>`;
  $('previewModal').classList.remove('hidden');
}
function escapeHtml(s=''){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

function renderSaved(){
  const items=getContracts();
  const q=($('searchContracts')?.value||'').toLowerCase().trim();
  const filtered=items.filter(d=>!q||[d.clientName,d.clientPhone,d.id].some(v=>String(v||'').toLowerCase().includes(q)));
  $('savedContracts').innerHTML=filtered.length?filtered.map(d=>`<div class="saved-item"><div><strong>${escapeHtml(d.clientName)}</strong><div class="saved-meta">${d.id} · ${dateFmt(d.eventDate)} · ${money(d.total)} · ${d.completed?'✅ Realizado':'📅 Reservado'}</div></div><div class="saved-actions"><button class="btn btn-light" onclick="openSaved('${d.id}')">Ver</button>${d.completed?'':`<button class="btn btn-primary" onclick="completeContractAndStamp('${d.id}')">Realizado + sello</button>`}<button class="btn btn-danger-light" onclick="deleteSaved('${d.id}')">Eliminar</button></div></div>`).join(''):'<div class="empty">No se encontraron contratos.</div>';
}
function renderDashboard(){
  const items=getContracts();const today=new Date();today.setHours(0,0,0,0);
  const upcoming=items.filter(d=>d.eventDate&&new Date(d.eventDate+'T12:00:00')>=today).sort((a,b)=>a.eventDate.localeCompare(b.eventDate));
  $('statContracts').textContent=items.length;$('statUpcoming').textContent=upcoming.length;$('statIncome').textContent=money(items.reduce((a,d)=>a+Number(d.total||0),0));
  $('upcomingList').innerHTML=upcoming.length?upcoming.slice(0,5).map(d=>`<div class="upcoming-item"><div><strong>${escapeHtml(d.clientName)}</strong><div class="saved-meta">${dateFmt(d.eventDate)} · ${d.startTime||''} · ${escapeHtml((d.services&&d.services[0]?.name)||'Evento')}</div></div><span class="event-pill">Reservado</span></div>`).join(''):'<div class="empty">No hay próximos eventos registrados.</div>';
}
window.openSaved=id=>{const d=getContracts().find(x=>x.id===id);if(d){previewIsNewContract=false;renderPreview(d)}};
window.deleteSaved=id=>{if(confirm('¿Eliminar este contrato?'))setContracts(getContracts().filter(x=>x.id!==id))};

$('addServiceBtn').addEventListener('click',()=>addService());
['eventDate','startTime','endTime'].forEach(id=>{
  $(id).addEventListener('input',updateServiceAvailability);
  $(id).addEventListener('change',updateServiceAvailability);
});
$('deposit').addEventListener('input',recalculateBalance);$('discount').addEventListener('input',recalculateTotal);
$('saveBtn').addEventListener('click',()=>{if(!form.reportValidity())return;const d=collectData();if(!validateAvailability(d))return;saveContract(d);alert('Contrato guardado correctamente.');});
form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;const d=collectData();if(!validateAvailability(d))return;saveContract(d);previewIsNewContract=true;renderPreview(d)});

function resetForNewContract(){
  // Reinicio completo: no conservar ningún dato del contrato anterior.
  form.reset();
  servicesList.innerHTML='';

  $('clientName').value='';
  $('clientPhone').value='';
  $('eventAddress').value='';
  $('mapsLink').value='';
  $('eventDate').value='';
  $('eventType').value='Cumpleaños';
  $('startTime').value='';
  $('endTime').value='';
  $('installTime').value='';
  $('pickupTime').value='';
  $('childrenCount').value='';
  $('electricity').value='Sí';
  $('subtotal').value='0.00';
  $('discount').value='0';
  $('discountReason').value='';
  $('total').value='0.00';
  $('deposit').value='0';
  $('balance').value='0.00';
  $('paymentMethod').value='Efectivo';
  $('notes').value='';
  $('acceptRules').checked=false;

  addService({name:'',qty:1,duration:'4',price:0});
  ctx.clearRect(0,0,canvas.width,canvas.height);
  $('contractNumber').textContent=contractId();
  currentPreviewData=null;
  recalculateTotal();
  updateServiceAvailability();
  showView('new');
  window.scrollTo({top:0,behavior:'auto'});
}

$('closePreview').addEventListener('click',()=>{
  $('previewModal').classList.add('hidden');
  if(previewIsNewContract){
    resetForNewContract();
    previewIsNewContract=false;
  }
});
$('printContract').addEventListener('click',()=>{document.body.classList.add('printing-contract');window.print();setTimeout(()=>document.body.classList.remove('printing-contract'),500)});
$('clearAllBtn').addEventListener('click',()=>{if(confirm('¿Borrar todos los contratos guardados en este dispositivo?'))setContracts([])});

// Firma táctil
const canvas=$('signatureCanvas'),ctx=canvas.getContext('2d');let drawing=false;
function resizeCanvas(){const ratio=Math.max(window.devicePixelRatio||1,1);const rect=canvas.getBoundingClientRect();const old=canvas.toDataURL();canvas.width=rect.width*ratio;canvas.height=rect.height*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.lineWidth=2.2;ctx.lineCap='round';ctx.strokeStyle='#111';const img=new Image();img.onload=()=>ctx.drawImage(img,0,0,rect.width,rect.height);img.src=old}
function pos(e){const r=canvas.getBoundingClientRect(),p=e.touches?e.touches[0]:e;return{x:p.clientX-r.left,y:p.clientY-r.top}}
function start(e){drawing=true;const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);e.preventDefault()}
function move(e){if(!drawing)return;const p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke();e.preventDefault()}
function end(){drawing=false}
['mousedown','touchstart'].forEach(x=>canvas.addEventListener(x,start,{passive:false}));['mousemove','touchmove'].forEach(x=>canvas.addEventListener(x,move,{passive:false}));['mouseup','mouseleave','touchend'].forEach(x=>canvas.addEventListener(x,end));
$('clearSignature').addEventListener('click',()=>ctx.clearRect(0,0,canvas.width,canvas.height));window.addEventListener('resize',resizeCanvas);



function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines=99){
  const words=String(text||'').split(/\s+/);let line='',lines=[];
  for(const word of words){const test=line?line+' '+word:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word}else line=test}
  if(line)lines.push(line);
  lines=lines.slice(0,maxLines);
  lines.forEach((ln,i)=>ctx.fillText(ln,x,y+i*lineHeight));
  return y+lines.length*lineHeight;
}

async function contractCanvas(d){
  const W=1240,H=1950, c=document.createElement('canvas');c.width=W;c.height=H;
  const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,W,H);
  g.fillStyle='#45b54a';g.fillRect(0,0,W,178);
  g.fillStyle='#fff';g.textAlign='center';g.font='bold 54px Arial';g.fillText(COMPANY.name,W/2,72);
  g.font='25px Arial';g.fillText('Renta de brincolines y mobiliario para fiestas infantiles',W/2,113);
  g.font='20px Arial';g.fillText(`${COMPANY.address}  ·  WhatsApp: ${COMPANY.whatsapp}`,W/2,148);
  g.textAlign='left';let y=222;const L=72,R=W-72;
  g.fillStyle='#111';g.font='bold 28px Arial';g.fillText(`CONTRATO ${d.id}`,L,y);g.textAlign='right';g.font='22px Arial';g.fillText(dateFmt(d.eventDate),R,y);g.textAlign='left';y+=44;
  g.strokeStyle='#d7e8d3';g.lineWidth=2;g.strokeRect(L,y,R-L,180);
  g.font='bold 20px Arial';g.fillText('CLIENTE',L+20,y+34);g.font='20px Arial';g.fillText(d.clientName,L+20,y+68);g.fillText(`Teléfono: ${d.clientPhone}`,L+20,y+102);
  g.font='bold 20px Arial';g.fillText('EVENTO',W/2+20,y+34);g.font='20px Arial';g.fillText(`${d.eventType} · ${d.startTime} a ${d.endTime}`,W/2+20,y+68);g.fillText(`Instalación: ${d.installTime||'—'} · Retiro: ${d.pickupTime||'—'}`,W/2+20,y+102);
  g.font='18px Arial';drawWrappedText(g,`Dirección: ${d.eventAddress}`,L+20,y+143,R-L-40,23,2);y+=218;
  g.fillStyle='#eef8ec';g.fillRect(L,y,R-L,42);g.fillStyle='#173a19';g.font='bold 19px Arial';g.fillText('SERVICIO',L+14,y+28);g.fillText('CANT.',730,y+28);g.fillText('TIEMPO',830,y+28);g.textAlign='right';g.fillText('PRECIO',R-14,y+28);g.textAlign='left';y+=54;
  g.font='18px Arial';
  for(const s of d.services){
    const rowH=62;g.strokeStyle='#e5e7eb';g.beginPath();g.moveTo(L,y+rowH);g.lineTo(R,y+rowH);g.stroke();
    drawWrappedText(g,s.name,L+10,y+23,620,22,2);g.fillText(String(s.qty),748,y+23);g.fillText(s.durationLabel,830,y+23);g.textAlign='right';g.fillText(money(s.price),R-10,y+23);g.textAlign='left';y+=rowH;
  }
  y+=20;const payBoxH=d.discountReason?225:170;g.fillStyle='#f7faf7';g.fillRect(660,y,R-660,payBoxH);g.fillStyle='#111';g.font='19px Arial';g.fillText(`Subtotal: ${money(d.subtotal ?? (Number(d.total||0)+Number(d.discount||0)))}`,690,y+32);g.fillText(`Descuento: ${money(d.discount||0)}`,690,y+65);let payOffset=0;if(d.discountReason){g.font='16px Arial';g.fillText('Razón:',690,y+96);drawWrappedText(g,d.discountReason,760,y+96,R-780,19,2);payOffset=55;}g.font='bold 22px Arial';g.fillText(`Total: ${money(d.total)}`,690,y+101+payOffset);g.font='19px Arial';g.fillText(`Anticipo: ${money(d.deposit)}`,690,y+134+payOffset);g.font='bold 22px Arial';g.fillText(`Saldo: ${money(d.balance)}`,900,y+134+payOffset);y+=payBoxH+34;
  g.font='bold 23px Arial';g.fillText('Condiciones generales',L,y);y+=34;g.font='17px Arial';
  const conditions=[
    'El cliente se compromete a proporcionar un espacio adecuado y seguro para la instalación del equipo.',
    'El cliente será responsable de daños ocasionados por mal uso, objetos punzocortantes, fuego, líquidos, mascotas o negligencia.',
    'En caso de lluvia, fuertes vientos o condiciones de riesgo, Brinky Fiesta podrá suspender o cancelar el servicio.',
    'El equipo permanecerá instalado únicamente durante el horario contratado.',
    'El total del costo del servicio deberá quedar liquidado el día del evento, antes de la instalación del equipo.',
    'El anticipo garantiza la reserva y no será reembolsable si el cliente cancela dentro de las 24 horas previas.',
    'El cliente proporcionará una toma de corriente de 127 V en buen estado, a no más de 20 metros de la instalación.',
    'El cliente será responsable del equipo desde la instalación hasta su retiro por Brinky Fiesta.',
    'El equipo deberá usarse siempre bajo la supervisión de un adulto responsable.',
    'El cliente manifiesta haber leído y aceptado todas las condiciones del contrato.'
  ];
  conditions.forEach((t,i)=>{
    g.font=(i===4?'bold 16px Arial':'16px Arial');
    g.fillText(`${i+1}.`,L,y);
    y=drawWrappedText(g,t,L+28,y,R-L-28,20,3)+4;
  });
  if(d.notes){y+=8;g.font='bold 18px Arial';g.fillText('Observaciones:',L,y);g.font='17px Arial';y=drawWrappedText(g,d.notes,L+135,y,R-L-135,22,3)}
  y=Math.min(y+18,1450);
  try{const img=new Image();img.src=d.signature;await img.decode();g.drawImage(img,L,y,340,125)}catch{}
  g.strokeStyle='#666';g.beginPath();g.moveTo(L,y+132);g.lineTo(L+390,y+132);g.stroke();g.font='17px Arial';g.fillText('Firma del cliente',L+110,y+158);g.font='15px Arial';g.fillText(d.clientName,L+95,y+182);
  y+=218;
  // Llamado a la acción de Facebook al final del contrato.
  const ctaTop=Math.min(y,H-330);
  g.fillStyle='#eefcf4';g.fillRect(L,ctaTop,R-L,244);
  try{
    const banner=new Image();banner.src='assets/facebook-banner.jpg';await banner.decode();
    const bw=430,bh=154;g.drawImage(banner,L+18,ctaTop+18,bw,bh);
  }catch{}
  g.fillStyle='#08752f';g.font='bold 23px Arial';g.fillText('¿Disfrutaste nuestro servicio?',L+475,ctaTop+48);
  g.fillStyle='#263238';g.font='17px Arial';drawWrappedText(g,'Tu recomendación nos ayuda a que más familias conozcan Brinky Fiesta. Visita nuestra página Brincolines Brinky Fiesta y déjanos una buena referencia.',L+475,ctaTop+82,R-(L+475)-20,22,5);
  g.fillStyle='#1877f2';g.font='bold 18px Arial';g.fillText('Facebook: Brincolines Brinky Fiesta',L+475,ctaTop+192);
  g.textAlign='center';g.font='15px Arial';g.fillStyle='#555';g.fillText('Brinky Fiesta · WhatsApp 999 447 6314 · Facebook: Brincolines Brinky Fiesta',W/2,H-36);
  return c;
}

function jpegToPdfBlob(dataUrl,widthPx,heightPx){
  const raw=atob(dataUrl.split(',')[1]);const img=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)img[i]=raw.charCodeAt(i);
  const enc=new TextEncoder();const parts=[];let offset=0;const offsets=[0];
  const pushText=t=>{const b=enc.encode(t);parts.push(b);offset+=b.length};const pushBytes=b=>{parts.push(b);offset+=b.length};
  pushText('%PDF-1.4\n%âãÏÓ\n');
  const obj=(n,body)=>{offsets[n]=offset;pushText(`${n} 0 obj\n${body}\nendobj\n`)};
  obj(1,'<< /Type /Catalog /Pages 2 0 R >>');obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
  offsets[4]=offset;pushText(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`);pushBytes(img);pushText('\nendstream\nendobj\n');
  const content='q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n';obj(5,`<< /Length ${content.length} >>\nstream\n${content}endstream`);
  const xref=offset;pushText('xref\n0 6\n0000000000 65535 f \n');for(let i=1;i<=5;i++)pushText(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
  pushText(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts,{type:'application/pdf'});
}

async function createPdfFile(d){
  const c=await contractCanvas(d);const blob=jpegToPdfBlob(c.toDataURL('image/jpeg',0.9),c.width,c.height);
  return new File([blob],`${d.id}-Brinky-Fiesta.pdf`,{type:'application/pdf'});
}

async function shareContract(){
  if(!currentPreviewData)return;
  const btn=$('shareContract');const old=btn.textContent;btn.disabled=true;btn.textContent='Preparando PDF…';
  try{
    const file=await createPdfFile(currentPreviewData);
    const text=`Hola ${currentPreviewData.clientName}, te compartimos tu contrato de Brinky Fiesta. Folio ${currentPreviewData.id}. Fecha: ${dateFmt(currentPreviewData.eventDate)}. Saldo pendiente: ${money(currentPreviewData.balance)}.`;
    if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){await navigator.share({title:`Contrato ${currentPreviewData.id}`,text,files:[file]});}
    else{
      const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
      const phone=String(currentPreviewData.clientPhone||'').replace(/\D/g,'');window.open(`https://wa.me/${phone.length===10?'52'+phone:phone}?text=${encodeURIComponent(text+' El PDF se descargó en tu dispositivo; adjúntalo en este chat.')}`,'_blank');
      alert('Tu navegador no permite compartir archivos directamente. El PDF se descargó y se abrió WhatsApp para que lo adjuntes.');
    }
  }catch(err){if(err?.name!=='AbortError'){console.error(err);alert('No se pudo compartir el PDF. Prueba con Chrome o Safari actualizado.')}}finally{btn.disabled=false;btn.textContent=old}
}
$('shareContract').addEventListener('click',shareContract);


async function downloadPdf(){
  if(!currentPreviewData)return;
  const btn=$('downloadPdf');const old=btn.textContent;btn.disabled=true;btn.textContent='Preparando…';
  try{const file=await createPdfFile(currentPreviewData);const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000)}
  catch(err){console.error(err);alert('No se pudo guardar el PDF.')}finally{btn.disabled=false;btn.textContent=old}
}
$('downloadPdf').addEventListener('click',downloadPdf);
$('searchContracts').addEventListener('input',renderSaved);
$('reportMonth').addEventListener('change',renderReports);$('reportYear').addEventListener('change',renderReports);
$('expenseForm').addEventListener('submit',e=>{e.preventDefault();const amount=Number($('expenseAmount').value||0);if(amount<=0)return;const items=getExpenses();items.unshift({id:'EXP-'+Date.now(),date:$('expenseDate').value,category:$('expenseCategory').value,description:$('expenseDescription').value.trim(),amount});localStorage.setItem(EXPENSES_KEY,JSON.stringify(items));$('expenseDescription').value='';$('expenseAmount').value='';const d=new Date($('expenseDate').value+'T12:00:00');$('reportMonth').value=String(d.getMonth()+1);$('reportYear').value=String(d.getFullYear());renderReports();});
function showView(name){
  const map={home:'homeView',new:'newView',quotes:'quotesView',contracts:'contractsView',reports:'reportsView',loyalty:'loyaltyView',messages:'messagesView'};
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  $(map[name]||'homeView').classList.add('active');
  document.querySelectorAll('[data-go]').forEach(b=>b.classList.toggle('active',b.dataset.go===name));
  if(name==='home')renderDashboard();if(name==='contracts')renderSaved();if(name==='quotes')renderQuotes();if(name==='reports')renderReports();if(name==='loyalty')renderLoyalty();if(name==='messages')renderMessages();window.scrollTo(0,0);
}
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.go)));
// PWA
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBtn').classList.remove('hidden');$('installCard')?.classList.remove('hidden')});
async function requestInstall(){
  if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBtn').classList.add('hidden');$('installCard')?.classList.add('hidden');return;}
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  alert(ios?'En Safari toca Compartir y después “Agregar a pantalla de inicio”.':'En Chrome abre el menú de tres puntos y toca “Instalar aplicación” o “Agregar a pantalla principal”.');
}
$('installBtn').addEventListener('click',requestInstall);
$('installCardBtn').addEventListener('click',requestInstall);
window.addEventListener('appinstalled',()=>{$('installCard')?.classList.add('hidden');$('installedBadge')?.classList.remove('hidden');});
if(window.matchMedia('(display-mode: standalone)').matches || navigator.standalone){$('installCard')?.classList.add('hidden');$('installedBadge')?.classList.remove('hidden');}
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');

(function init(){
  $('contractNumber').textContent=contractId();
  addService({name:'',qty:1,duration:'4',price:0});
  updateServiceAvailability();
  resizeCanvas();
  initReportFilters();
  renderSaved();
  renderDashboard();
  renderReports();
  recalculateTotal();
  showView('home');
})();

// ==================== COTIZACIONES v3.8 ====================
const quoteForm=$('quoteForm');
const quoteServicesList=$('quoteServicesList');
let currentQuote=null;

function getQuotes(){try{return JSON.parse(localStorage.getItem(QUOTES_KEY))||[]}catch{return []}}
function setQuotes(items){localStorage.setItem(QUOTES_KEY,JSON.stringify(items));renderQuotes()}
function quoteId(){
  const y=new Date().getFullYear();
  const highest=getQuotes().map(q=>String(q.id||'')).filter(id=>id.startsWith(`COT-${y}-`)).reduce((m,id)=>Math.max(m,Number(id.split('-').pop())||0),0);
  return `COT-${y}-${String(highest+1).padStart(6,'0')}`;
}
function addQuoteService(data={}){
  const row=serviceTemplate.content.firstElementChild.cloneNode(true);
  row.querySelector('.service-status')?.remove();
  const select=row.querySelector('.service-name'),custom=row.querySelector('.service-custom');
  const requested=String(data.name||'');
  const names=[...select.options].map(o=>o.value);
  if(requested&&!names.includes(requested)){select.value='OTRO';custom.value=requested;custom.classList.remove('hidden')}else select.value=requested;
  const sync=()=>custom.classList.toggle('hidden',select.value!=='OTRO');select.addEventListener('change',sync);sync();
  row.querySelector('.service-qty').value=data.qty||1;
  row.querySelector('.service-duration').value=data.duration||'4';
  row.querySelector('.service-price').value=data.price||0;
  row.querySelector('.remove-service').addEventListener('click',()=>{row.remove();recalculateQuote()});
  row.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',recalculateQuote));
  quoteServicesList.appendChild(row);recalculateQuote();
}
function getQuoteServices(){return [...quoteServicesList.querySelectorAll('.service-row')].map(row=>({
  name:row.querySelector('.service-name').value==='OTRO'?(row.querySelector('.service-custom').value.trim()||'OTRO'):row.querySelector('.service-name').value,
  qty:Number(row.querySelector('.service-qty').value||0),duration:row.querySelector('.service-duration').value,
  durationLabel:row.querySelector('.service-duration').selectedOptions[0].textContent,price:Number(row.querySelector('.service-price').value||0)
}))}
function recalculateQuote(){
  const subtotal=getQuoteServices().reduce((s,x)=>s+Number(x.price||0),0),discount=Math.max(0,Number($('quoteDiscount')?.value||0));
  $('quoteSubtotal').value=subtotal.toFixed(2);$('quoteTotal').value=Math.max(0,subtotal-discount).toFixed(2);
}
function quoteExpiry(createdAt,days){const d=new Date(createdAt||Date.now());d.setDate(d.getDate()+Number(days||7));return d.toISOString().slice(0,10)}
function effectiveQuoteStatus(q){if(q.status==='Convertida'||q.status==='Aceptada'||q.status==='Rechazada')return q.status;return q.expiresAt&&new Date(q.expiresAt+'T23:59:59')<new Date()?'Vencida':(q.status||'Pendiente')}
function collectQuote(){
  const createdAt=new Date().toISOString(),validity=Number($('quoteValidity').value||7);
  return {id:$('quoteNumber').textContent,createdAt,clientName:$('quoteClientName').value.trim(),clientPhone:$('quoteClientPhone').value.trim(),eventAddress:$('quoteAddress').value.trim(),eventDate:$('quoteEventDate').value,validityDays:validity,expiresAt:quoteExpiry(createdAt,validity),status:$('quoteStatus').value,services:getQuoteServices(),subtotal:Number($('quoteSubtotal').value||0),discount:Number($('quoteDiscount').value||0),total:Number($('quoteTotal').value||0),notes:$('quoteNotes').value.trim()}
}
function saveQuote(q){const items=getQuotes(),i=items.findIndex(x=>x.id===q.id);if(i>=0)items[i]=q;else items.unshift(q);setQuotes(items)}
function resetQuoteForm(){quoteForm.reset();quoteServicesList.innerHTML='';$('quoteNumber').textContent=quoteId();$('quoteValidity').value='7';$('quoteStatus').value='Pendiente';$('quoteDiscount').value='0';addQuoteService({name:'',qty:1,duration:'4',price:0});recalculateQuote()}
function renderQuotes(){
  if(!$('savedQuotes'))return;const q=($('searchQuotes')?.value||'').toLowerCase().trim();
  const items=getQuotes().filter(x=>!q||[x.id,x.clientName,x.clientPhone].some(v=>String(v||'').toLowerCase().includes(q)));
  $('savedQuotes').innerHTML=items.length?items.map(x=>{const st=effectiveQuoteStatus(x);return `<div class="saved-item quote-item"><div><strong>${escapeHtml(x.clientName||'Sin nombre')}</strong><div class="saved-meta">${x.id} · ${x.eventDate?dateFmt(x.eventDate):'Fecha tentativa pendiente'} · ${money(x.total)}</div><span class="quote-status ${st}">${st}</span></div><div class="saved-actions"><button class="btn btn-light" onclick="openQuote('${x.id}')">Ver</button><button class="btn btn-danger-light" onclick="deleteQuote('${x.id}')">Eliminar</button></div></div>`}).join(''):'<div class="empty">No se encontraron cotizaciones.</div>'
}
function renderQuotePreview(q){
  currentQuote=q;const rows=(q.services||[]).map(s=>`<tr><td>${escapeHtml(s.name)}</td><td>${s.qty}</td><td>${escapeHtml(s.durationLabel)}</td><td class="money">${money(s.price)}</td></tr>`).join('');
  const st=effectiveQuoteStatus(q);
  $('quotePreview').innerHTML=`<div class="contract-header"><h1>${COMPANY.name}</h1><div>Renta de brincolines y mobiliario para fiestas infantiles</div><div class="company-data">${COMPANY.address}<br>WhatsApp: ${COMPANY.whatsapp}<br>Facebook: ${COMPANY.facebook}</div><strong>COTIZACIÓN ${q.id}</strong></div>
  <div class="contract-grid"><div><strong>Cliente:</strong> ${escapeHtml(q.clientName)}</div><div><strong>Teléfono:</strong> ${escapeHtml(q.clientPhone)}</div><div><strong>Fecha tentativa:</strong> ${q.eventDate?dateFmt(q.eventDate):'Por definir'}</div><div><strong>Estado:</strong> ${st}</div><div><strong>Zona:</strong> ${escapeHtml(q.eventAddress||'Por definir')}</div><div><strong>Vigente hasta:</strong> ${dateFmt(q.expiresAt)}</div></div>
  <table><thead><tr><th>Servicio</th><th>Cantidad</th><th>Tiempo</th><th>Precio</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="quote-summary"><div><strong>Subtotal:</strong> ${money(q.subtotal)}</div><div><strong>Descuento:</strong> ${money(q.discount)}</div><div style="font-size:1.2rem;margin-top:7px"><strong>Total estimado:</strong> ${money(q.total)}</div></div>
  ${q.notes?`<p><strong>Notas:</strong> ${escapeHtml(q.notes)}</p>`:''}<div class="quote-notice">Esta cotización no reserva la fecha ni garantiza disponibilidad. La reserva se confirma únicamente al recibir el anticipo y generar el contrato.</div>
  <p style="text-align:center;color:#667085">Cotización válida por ${q.validityDays} días · ${q.id}</p>`;
  $('quotePreviewModal').classList.remove('hidden')
}
window.openQuote=id=>{const q=getQuotes().find(x=>x.id===id);if(q)renderQuotePreview(q)};
window.deleteQuote=id=>{if(confirm('¿Eliminar esta cotización?'))setQuotes(getQuotes().filter(x=>x.id!==id))};
function convertQuoteToContract(q){
  if(!q)return;showView('new');resetForNewContract();
  $('clientName').value=q.clientName||'';$('clientPhone').value=q.clientPhone||'';$('eventAddress').value=q.eventAddress||'';$('eventDate').value=q.eventDate||'';
  servicesList.innerHTML='';(q.services||[]).forEach(s=>addService(s));if(!(q.services||[]).length)addService({name:'',qty:1,duration:'4',price:0});
  $('notes').value=`Convertido desde ${q.id}${q.notes?' · '+q.notes:''}`;$('discount').value=String(q.discount||0);$('discountReason').value=q.discount>0?'Descuento aplicado en cotización '+q.id:'';$('deposit').value='0';recalculateTotal();updateServiceAvailability();
  const items=getQuotes(),i=items.findIndex(x=>x.id===q.id);if(i>=0){items[i]={...items[i],status:'Convertida',convertedTo:$('contractNumber').textContent};setQuotes(items)}
  $('quotePreviewModal').classList.add('hidden');alert('Cotización cargada como contrato. Completa los horarios, anticipo y firma antes de generar.')
}
async function quoteCanvas(q){
  const W=1240,H=1754,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,W,H);g.fillStyle='#16a34a';g.fillRect(0,0,W,180);g.fillStyle='#fff';g.textAlign='center';g.font='bold 54px Arial';g.fillText(COMPANY.name,W/2,72);g.font='25px Arial';g.fillText('COTIZACIÓN DE SERVICIOS',W/2,116);g.font='19px Arial';g.fillText(`${COMPANY.address} · WhatsApp ${COMPANY.whatsapp}`,W/2,150);g.textAlign='left';let y=230,L=72,R=W-72;g.fillStyle='#111';g.font='bold 28px Arial';g.fillText(q.id,L,y);g.textAlign='right';g.font='20px Arial';g.fillText(`Vigente hasta ${dateFmt(q.expiresAt)}`,R,y);g.textAlign='left';y+=45;g.strokeStyle='#d7e8d3';g.strokeRect(L,y,R-L,160);g.font='bold 20px Arial';g.fillText('CLIENTE',L+20,y+35);g.font='20px Arial';g.fillText(q.clientName,L+20,y+72);g.fillText(`Teléfono: ${q.clientPhone}`,L+20,y+108);g.font='bold 20px Arial';g.fillText('EVENTO TENTATIVO',W/2+20,y+35);g.font='20px Arial';g.fillText(q.eventDate?dateFmt(q.eventDate):'Fecha por definir',W/2+20,y+72);drawWrappedText(g,q.eventAddress||'Zona por definir',W/2+20,y+108,R-(W/2+20),22,2);y+=205;g.fillStyle='#eef8ec';g.fillRect(L,y,R-L,42);g.fillStyle='#173a19';g.font='bold 19px Arial';g.fillText('SERVICIO',L+14,y+28);g.fillText('CANT.',730,y+28);g.fillText('TIEMPO',830,y+28);g.textAlign='right';g.fillText('PRECIO',R-10,y+28);g.textAlign='left';y+=42;g.font='18px Arial';for(const s of q.services||[]){const rh=62;g.strokeStyle='#e5e7eb';g.beginPath();g.moveTo(L,y+rh);g.lineTo(R,y+rh);g.stroke();drawWrappedText(g,s.name,L+10,y+23,620,22,2);g.fillText(String(s.qty),748,y+23);g.fillText(s.durationLabel,830,y+23);g.textAlign='right';g.fillText(money(s.price),R-10,y+23);g.textAlign='left';y+=rh}y+=30;g.fillStyle='#f1fff5';g.fillRect(690,y,R-690,145);g.fillStyle='#111';g.font='20px Arial';g.fillText(`Subtotal: ${money(q.subtotal)}`,720,y+38);g.fillText(`Descuento: ${money(q.discount)}`,720,y+76);g.font='bold 25px Arial';g.fillText(`Total estimado: ${money(q.total)}`,720,y+120);y+=190;if(q.notes){g.font='bold 21px Arial';g.fillText('Notas:',L,y);g.font='18px Arial';y=drawWrappedText(g,q.notes,L+75,y,R-L-75,24,5)+24}g.fillStyle='#fff7e6';g.fillRect(L,y,R-L,125);g.fillStyle='#8a4b00';g.font='bold 19px Arial';drawWrappedText(g,'Esta cotización no reserva la fecha ni garantiza disponibilidad. La reserva se confirma únicamente al recibir el anticipo y generar el contrato.',L+20,y+38,R-L-40,27,4);g.textAlign='center';g.fillStyle='#555';g.font='17px Arial';g.fillText(`Válida por ${q.validityDays} días · Brinky Fiesta · ${COMPANY.whatsapp}`,W/2,H-55);return c
}
async function createQuotePdfFile(q){const c=await quoteCanvas(q),blob=jpegToPdfBlob(c.toDataURL('image/jpeg',.92),c.width,c.height);return new File([blob],`${q.id}-Cotizacion-Brinky-Fiesta.pdf`,{type:'application/pdf'})}
async function shareQuoteFile(){if(!currentQuote)return;const file=await createQuotePdfFile(currentQuote),text=`Hola ${currentQuote.clientName}, te compartimos la cotización ${currentQuote.id} de Brinky Fiesta por ${money(currentQuote.total)}. Vigente hasta ${dateFmt(currentQuote.expiresAt)}. Esta cotización no reserva la fecha.`;if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]})))await navigator.share({title:`Cotización ${currentQuote.id}`,text,files:[file]});else{const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);const phone=String(currentQuote.clientPhone||'').replace(/\D/g,'');window.open(`https://wa.me/${phone.length===10?'52'+phone:phone}?text=${encodeURIComponent(text+' El PDF se descargó; adjúntalo en este chat.')}`,'_blank')}}
async function downloadQuote(){if(!currentQuote)return;const file=await createQuotePdfFile(currentQuote),url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000)}
function initQuotes(){
  $('quoteNumber').textContent=quoteId();addQuoteService({name:'',qty:1,duration:'4',price:0});
  $('addQuoteServiceBtn').addEventListener('click',()=>addQuoteService());$('quoteDiscount').addEventListener('input',recalculateQuote);
  $('saveQuoteBtn').addEventListener('click',()=>{if(!quoteForm.reportValidity())return;const q=collectQuote();saveQuote(q);alert('Cotización guardada correctamente.');resetQuoteForm()});
  quoteForm.addEventListener('submit',e=>{e.preventDefault();if(!quoteForm.reportValidity())return;const q=collectQuote();saveQuote(q);renderQuotePreview(q)});
  $('searchQuotes').addEventListener('input',renderQuotes);$('closeQuotePreview').addEventListener('click',()=>{$('quotePreviewModal').classList.add('hidden');resetQuoteForm()});
  $('convertQuoteBtn').addEventListener('click',()=>convertQuoteToContract(currentQuote));$('shareQuote').addEventListener('click',()=>shareQuoteFile().catch(e=>e?.name!=='AbortError'&&alert('No se pudo compartir la cotización.')));$('downloadQuotePdf').addEventListener('click',()=>downloadQuote().catch(()=>alert('No se pudo guardar el PDF.')));$('printQuote').addEventListener('click',()=>{document.body.classList.add('printing-quote');window.print();setTimeout(()=>document.body.classList.remove('printing-quote'),500)});renderQuotes();recalculateQuote()
}

initQuotes();


// ==================== CLUB BRINKY v5.0 VIP ====================
let currentLoyaltyId=null;
function getLoyalty(){try{return JSON.parse(localStorage.getItem(LOYALTY_KEY))||[]}catch{return []}}
function setLoyalty(items){localStorage.setItem(LOYALTY_KEY,JSON.stringify(items));renderLoyalty()}
function getLoyaltySettings(){try{return {...{r1:4,n1:'50% de descuento',r2:8,n2:'1 renta gratis'},...(JSON.parse(localStorage.getItem(LOYALTY_SETTINGS_KEY))||{})}}catch{return {r1:4,n1:'50% de descuento',r2:8,n2:'1 renta gratis'}}}
function normalizedPhone(v=''){return String(v).replace(/\D/g,'').slice(-10)}
function nextLoyaltyCode(){const max=getLoyalty().reduce((m,c)=>Math.max(m,Number(String(c.code||'').replace(/\D/g,''))||0),0);return 'BRK-'+String(max+1).padStart(4,'0')}
function saveLoyaltyClient(data){const items=getLoyalty(),i=items.findIndex(x=>x.id===data.id);if(i>=0)items[i]=data;else items.unshift(data);setLoyalty(items)}
function ensureLoyaltyClient(name,phone){const key=normalizedPhone(phone);let c=getLoyalty().find(x=>normalizedPhone(x.phone)===key&&key);if(c)return c;c={id:'LC-'+Date.now(),code:nextLoyaltyCode(),name:name||'Cliente',phone:phone||'',birthday:'',notes:'',stamps:0,totalRents:0,totalSpent:0,referrals:0,history:[],createdAt:new Date().toISOString()};saveLoyaltyClient(c);return c}
window.completeContractAndStamp=id=>{const contracts=getContracts(),i=contracts.findIndex(x=>x.id===id);if(i<0)return;if(!confirm('¿Marcar el servicio como realizado y agregar 1 Estrella Brinky al cliente?'))return;const d=contracts[i],c=ensureLoyaltyClient(d.clientName,d.clientPhone);const clients=getLoyalty(),ci=clients.findIndex(x=>x.id===c.id);clients[ci].stamps=Number(clients[ci].stamps||0)+1;clients[ci].totalRents=Number(clients[ci].totalRents||0)+1;clients[ci].totalSpent=Number(clients[ci].totalSpent||0)+Number(d.total||0);clients[ci].history.unshift({date:new Date().toISOString(),type:'stamp',text:`Estrella Brinky por contrato ${d.id}`,contractId:d.id});localStorage.setItem(LOYALTY_KEY,JSON.stringify(clients));queueLoyaltyMessage(clients[ci],rewardStatus(clients[ci])?'reward':'update',`contract-${d.id}`);contracts[i]={...d,completed:true,completedAt:new Date().toISOString(),loyaltyClientId:c.id};setContracts(contracts);renderLoyalty();alert('Servicio realizado. Se agregó 1 Estrella Brinky a la tarjeta del cliente.')}
function rewardStatus(c){const s=getLoyaltySettings(),st=Number(c.stamps||0);if(st>=s.r2)return {name:s.n2,target:s.r2};if(st>=s.r1)return {name:s.n1,target:s.r1};return null}

function loyaltyTier(stamps){const n=Number(stamps||0);if(n>=16)return {name:'DIAMANTE',icon:'💎'};if(n>=8)return {name:'ORO',icon:'🥇'};if(n>=4)return {name:'PLATA',icon:'🥈'};return {name:'BRONCE',icon:'🥉'}}
function loyaltyNext(c){const s=getLoyaltySettings(),n=Number(c.stamps||0);if(n<s.r1)return {left:s.r1-n,name:s.n1,target:s.r1};if(n<s.r2)return {left:s.r2-n,name:s.n2,target:s.r2};return {left:0,name:s.n2,target:s.r2}}
function memberSince(c){try{return new Date(c.createdAt||Date.now()).toLocaleDateString('es-MX',{month:'long',year:'numeric'})}catch{return ''}}

function renderLoyalty(){if(!$('loyaltyList'))return;const s=getLoyaltySettings();$('reward1Stamps').value=s.r1;$('reward1Name').value=s.n1;$('reward2Stamps').value=s.r2;$('reward2Name').value=s.n2;const q=($('searchLoyalty')?.value||'').toLowerCase().trim(),items=getLoyalty().filter(c=>!q||[c.name,c.phone,c.code].some(v=>String(v||'').toLowerCase().includes(q)));$('loyaltyClientCount').textContent=getLoyalty().length;if($('statMembers'))$('statMembers').textContent=getLoyalty().length;$('loyaltyList').innerHTML=items.length?items.map(c=>{const r=rewardStatus(c);return `<div class="saved-item loyalty-item"><div><strong>${escapeHtml(c.name)}</strong><div class="saved-meta">${escapeHtml(c.code)} · ${escapeHtml(c.phone)} · ⭐ ${Number(c.stamps||0)} Estrellas Brinky · ${Number(c.totalRents||0)} rentas</div>${r?`<span class="reward-ready">🎁 ${escapeHtml(r.name)} disponible</span>`:''}</div><div class="saved-actions"><button class="btn btn-primary" onclick="openLoyalty('${c.id}')">Ver tarjeta</button><button class="btn btn-danger-light" onclick="deleteLoyalty('${c.id}')">Eliminar</button></div></div>`}).join(''):'<div class="empty">No hay clientes registrados en Club Brinky.</div>'}
window.deleteLoyalty=id=>{if(confirm('¿Eliminar este cliente y su historial de fidelidad?'))setLoyalty(getLoyalty().filter(x=>x.id!==id))}
function stampDots(stamps,target){let out='';for(let i=1;i<=target;i++)out+=`<span class="stamp-dot ${i<=stamps?'filled':''}">${i<=stamps?'★':'☆'}</span>`;return out}
function qrPayload(c){return `BRINKY FIESTA CLUB | ${c.code} | ${c.name} | ${c.phone}`}
function qrUrl(c,size=500){return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(qrPayload(c))}`}
window.openLoyalty=id=>{currentLoyaltyId=id;const c=getLoyalty().find(x=>x.id===id);if(!c)return;const s=getLoyaltySettings(),r=rewardStatus(c),tier=loyaltyTier(c.stamps),next=loyaltyNext(c),cta=next.left>0?`Te faltan solo <b>${next.left}</b> Estrella${next.left===1?'':'s'} Brinky para obtener <b>${escapeHtml(next.name)}</b>.`:`🎉 Ya desbloqueaste <b>${escapeHtml(next.name)}</b>.`;$('loyaltyCard').innerHTML=`<div class="vip-shine"></div><div class="vip-watermark">🐸</div><div class="loyalty-card-head"><img src="icons/icon-192.png" alt="Brinky"><div><h2>CLUB BRINKY</h2><p>MEMBRESÍA VIP · BRINKY FIESTA</p></div></div><div class="vip-tier">${tier.icon} NIVEL ${tier.name}</div><div class="loyalty-person"><h3>${escapeHtml(c.name)}</h3><p>🆔 ${escapeHtml(c.code)} · 📱 ${escapeHtml(c.phone)}</p><small>Miembro desde ${escapeHtml(memberSince(c))}</small></div><div class="stamp-grid">${stampDots(Number(c.stamps||0),s.r2)}</div><div class="loyalty-progress"><b>${Number(c.stamps||0)} de ${s.r2} Estrellas Brinky</b><span>${r?'🎁 Premio disponible: '+escapeHtml(r.name):'Próxima recompensa: '+escapeHtml(next.name)}</span></div><div class="qr-wrap"><img class="loyalty-qr" src="${qrUrl(c,300)}" alt="Código QR"><span>ESCANEA TU TARJETA</span></div><small>Consulta e identifica tu Tarjeta Club Brinky con este QR único.</small><div class="vip-cta">🎈 ${cta}</div><div class="referral-box">🤝 Comparte tu código <b>${escapeHtml(c.code)}</b><br><small>Cuando un amigo rente con tu código, ambos reciben 1 Estrella Brinky.</small></div>`;$('loyaltyHistory').innerHTML=(c.history||[]).length?(c.history||[]).map(h=>`<div class="history-row"><span>${new Date(h.date).toLocaleDateString('es-MX')}</span><b>${escapeHtml(h.text)}</b></div>`).join(''):'<div class="empty">Sin movimientos.</div>';$('loyaltyModal').classList.remove('hidden')}
function updateCurrentLoyalty(delta,text,type='adjustment'){const items=getLoyalty(),i=items.findIndex(x=>x.id===currentLoyaltyId);if(i<0)return;const before=Number(items[i].stamps||0);items[i].stamps=Math.max(0,before+delta);items[i].history=items[i].history||[];items[i].history.unshift({date:new Date().toISOString(),type,text});setLoyalty(items);if(delta>0){const s=getLoyaltySettings(),after=items[i].stamps,msgType=(before<s.r2&&after>=s.r2)||(before<s.r1&&after>=s.r1)?'reward':'update';queueLoyaltyMessage(items[i],msgType,`${type}-${Date.now()}`)}openLoyalty(currentLoyaltyId)}
$('loyaltyForm')?.addEventListener('submit',e=>{e.preventDefault();const phone=$('loyaltyPhone').value.trim(),key=normalizedPhone(phone),items=getLoyalty();if(items.some(c=>normalizedPhone(c.phone)===key&&key)){alert('Ya existe un cliente con ese teléfono.');return}const c={id:'LC-'+Date.now(),code:nextLoyaltyCode(),name:$('loyaltyName').value.trim(),phone,birthday:$('loyaltyBirthday').value,notes:$('loyaltyNotes').value.trim(),stamps:1,totalRents:0,totalSpent:0,referrals:0,history:[{date:new Date().toISOString(),type:'welcome',text:'Estrella Brinky de bienvenida'}],createdAt:new Date().toISOString()};const ref=$('loyaltyReferrer').value.trim().toUpperCase();if(ref){const ri=items.findIndex(x=>String(x.code).toUpperCase()===ref);if(ri>=0){items[ri].stamps=Number(items[ri].stamps||0)+1;items[ri].referrals=Number(items[ri].referrals||0)+1;items[ri].history.unshift({date:new Date().toISOString(),type:'referral',text:`Estrella Brinky por recomendar a ${c.name}`});c.stamps=2;c.history.unshift({date:new Date().toISOString(),type:'referral',text:`Estrella Brinky por referencia ${ref}`});c.referredBy=items[ri].id;queueLoyaltyMessage(items[ri],'referral',`ref-${c.id}`)}}items.unshift(c);setLoyalty(items);queueLoyaltyMessage(c,'welcome',`welcome-${c.id}`);e.target.reset();renderMessages();alert(`Cliente registrado con 1 Estrella de Bienvenida. Código: ${c.code}`)})
$('saveLoyaltySettings')?.addEventListener('click',()=>{const data={r1:Math.max(1,Number($('reward1Stamps').value||4)),n1:$('reward1Name').value.trim()||'Primer premio',r2:Math.max(1,Number($('reward2Stamps').value||8)),n2:$('reward2Name').value.trim()||'Premio principal'};if(data.r2<=data.r1){alert('La segunda meta debe ser mayor que la primera.');return}localStorage.setItem(LOYALTY_SETTINGS_KEY,JSON.stringify(data));renderLoyalty();alert('Configuración guardada.')})
function loyaltyMessage(c){const s=getLoyaltySettings(),r=rewardStatus(c),filled='⭐'.repeat(Math.min(Number(c.stamps||0),s.r2)),empty='⬜'.repeat(Math.max(0,s.r2-Number(c.stamps||0)));return `🎈 *¡Gracias por elegir Brinky Fiesta!* 🐸\n\n¡Hola *${c.name}*! Tu Tarjeta Digital del Club Brinky ha sido actualizada.\n\n🌟 *Estrellas Brinky:*\n${filled}${empty} (${c.stamps} de ${s.r2})\n\n🎁 *Tus beneficios:*\n⭐ ${s.r1} Estrellas Brinky = *${s.n1}*\n🏆 ${s.r2} Estrellas Brinky = *${s.n2}*\n${r?`\n🎉 *Ya puedes canjear: ${r.name}*\n`:''}\n🤝 *¡Recomienda y gana!*\nComparte tu código: *${c.code}*\nCuando un amigo rente usando tu código, ambos reciben *1 Estrella Brinky extra*.\n\n📱 Conserva el QR de tu tarjeta para identificarla fácilmente.\n\n💙 ¡Gracias por formar parte del Club Brinky!`}
async function fetchQrBlob(c){const r=await fetch(qrUrl(c,700));if(!r.ok)throw new Error('QR');return await r.blob()}
async function makeLoyaltyCardBlob(c){const s=getLoyaltySettings(),tier=loyaltyTier(c.stamps),next=loyaltyNext(c),canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1500;const g=canvas.getContext('2d');const round=(x,y,w,h,r,fill,stroke)=>{g.beginPath();g.roundRect(x,y,w,h,r);if(fill){g.fillStyle=fill;g.fill()}if(stroke){g.strokeStyle=stroke;g.lineWidth=6;g.stroke()}};const grad=g.createLinearGradient(0,0,1080,1500);grad.addColorStop(0,'#0b9d46');grad.addColorStop(.55,'#087a38');grad.addColorStop(1,'#064f29');g.fillStyle=grad;g.fillRect(0,0,1080,1500);for(let i=0;i<22;i++){g.fillStyle=`rgba(255,255,255,${.02+(i%3)*.01})`;g.beginPath();g.arc((i*197)%1080,(i*271)%1500,30+(i%5)*13,0,Math.PI*2);g.fill()}round(34,34,1012,1432,48,null,tier.name==='DIAMANTE'?'#d9f4ff':tier.name==='ORO'?'#ffd84d':tier.name==='PLATA'?'#e5e7eb':'#d99a63');g.textAlign='center';g.fillStyle='rgba(255,255,255,.08)';g.font='220px Arial';g.fillText('🐸',890,280);g.fillStyle='#fff';g.font='bold 68px Arial';g.fillText('CLUB BRINKY',540,110);g.font='bold 27px Arial';g.fillText('MEMBRESÍA VIP · BRINKY FIESTA',540,157);round(350,180,380,62,31,'rgba(255,255,255,.18)');g.font='bold 28px Arial';g.fillText(`${tier.icon} NIVEL ${tier.name}`,540,221);round(88,265,904,190,30,'#ffffff');g.fillStyle='#123b25';g.font='bold 49px Arial';g.fillText(String(c.name||'CLIENTE').toUpperCase(),540,335);g.fillStyle='#35634a';g.font='30px Arial';g.fillText(`${c.code}  ·  ${c.phone||'Sin teléfono'}`,540,385);g.font='24px Arial';g.fillText(`Miembro desde ${memberSince(c)}`,540,426);g.fillStyle='#fff';g.font='bold 37px Arial';g.fillText(`${c.stamps} de ${s.r2} Estrellas Brinky`,540,515);g.font='58px Arial';g.fillText('★'.repeat(Math.min(Number(c.stamps||0),s.r2))+'☆'.repeat(Math.max(0,s.r2-Number(c.stamps||0))),540,585);const qr=await createImageBitmap(await fetchQrBlob(c));round(312,635,456,456,30,'#fff');g.drawImage(qr,345,668,390,390);g.fillStyle='#fff';g.font='bold 28px Arial';g.fillText('ESCANEA TU TARJETA CLUB BRINKY',540,1140);g.font='23px Arial';g.fillText('QR único de identificación',540,1178);round(90,1215,900,118,26,'rgba(255,255,255,.14)');g.font='bold 28px Arial';const cta=next.left>0?`Te faltan ${next.left} Estrella${next.left===1?'':'s'} para ${next.name}`:`¡Premio disponible: ${next.name}!`;g.fillText(`🎈 ${cta}`,540,1265);g.font='23px Arial';g.fillText(`⭐ ${s.r1} = ${s.n1}   ·   🏆 ${s.r2} = ${s.n2}`,540,1307);g.font='bold 25px Arial';g.fillText(`🤝 Recomienda con ${c.code}: ambos ganan 1 Estrella`,540,1390);g.font='22px Arial';g.fillText('Cada fiesta suma diversión… ¡y también recompensas!',540,1437);return await new Promise(res=>canvas.toBlob(res,'image/png'))}
function saveBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
$('searchLoyalty')?.addEventListener('input',renderLoyalty);$('closeLoyaltyModal')?.addEventListener('click',()=>$('loyaltyModal').classList.add('hidden'));$('addStampBtn')?.addEventListener('click',()=>updateCurrentLoyalty(1,'Estrella Brinky agregada manualmente','stamp'));$('removeStampBtn')?.addEventListener('click',()=>updateCurrentLoyalty(-1,'Estrella Brinky retirada manualmente'));$('redeemRewardBtn')?.addEventListener('click',()=>{const c=getLoyalty().find(x=>x.id===currentLoyaltyId),r=c&&rewardStatus(c);if(!r){alert('El cliente todavía no tiene un premio disponible.');return}if(confirm(`¿Canjear ${r.name} y descontar ${r.target} Estrellas Brinky?`))updateCurrentLoyalty(-r.target,`Premio canjeado: ${r.name}`,'redeem')});
$('shareLoyaltyWhatsApp')?.addEventListener('click',async()=>{const c=getLoyalty().find(x=>x.id===currentLoyaltyId);if(!c)return;try{const blob=await makeLoyaltyCardBlob(c),file=new File([blob],`Tarjeta_Club_Brinky_${c.code}.png`,{type:'image/png'}),text=loyaltyMessage(c);if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:`Tarjeta Club Brinky ${c.code}`,text,files:[file]});}else{saveBlob(blob,file.name);const phone=normalizedPhone(c.phone);window.open(`https://wa.me/${phone?'52'+phone:''}?text=${encodeURIComponent(text+'\n\n📎 La tarjeta con el QR se descargó como imagen. Adjúntala en este chat.')}`,'_blank');alert('La tarjeta con QR se descargó como imagen. WhatsApp se abrirá para que la adjuntes.');}}catch(e){if(e?.name!=='AbortError')alert('No se pudo generar o compartir la tarjeta con QR. Verifica tu conexión a internet.')}});
$('downloadLoyaltyQr')?.addEventListener('click',async()=>{const c=getLoyalty().find(x=>x.id===currentLoyaltyId);if(!c)return;try{saveBlob(await fetchQrBlob(c),`QR_Club_Brinky_${c.code}.png`)}catch{alert('No se pudo descargar el QR. Verifica tu conexión a internet.')}});
$('shareLoyaltyCard')?.addEventListener('click',async()=>{const c=getLoyalty().find(x=>x.id===currentLoyaltyId);if(!c)return;try{const blob=await makeLoyaltyCardBlob(c),file=new File([blob],`Tarjeta_Club_Brinky_${c.code}.png`,{type:'image/png'});if(navigator.canShare?.({files:[file]})){await navigator.share({title:'Tarjeta Club Brinky',text:loyaltyMessage(c),files:[file]})}else{saveBlob(blob,file.name);alert('La tarjeta se descargó como imagen. Puedes adjuntarla en WhatsApp.')}}catch(e){if(e?.name!=='AbortError')alert('No se pudo compartir la tarjeta. Verifica tu conexión a internet.')}});
$('printLoyaltyCard')?.addEventListener('click',()=>{document.body.classList.add('printing-loyalty');window.print();setTimeout(()=>document.body.classList.remove('printing-loyalty'),500)});renderLoyalty();


// ==================== CENTRO DE MENSAJES v6.0 ====================
let currentMessageId=null;
let messageFilter='pending';
function getMessages(){try{return JSON.parse(localStorage.getItem(MESSAGES_KEY))||[]}catch{return []}}
function setMessages(items){localStorage.setItem(MESSAGES_KEY,JSON.stringify(items));renderMessages();updateMessageCounters()}
function messageTypeLabel(type){return ({welcome:'Bienvenida',update:'Actualización',reward:'Premio desbloqueado',referral:'Referencia'})[type]||'Aviso'}
function buildClubMessage(c,type){const s=getLoyaltySettings(),r=rewardStatus(c),filled='⭐'.repeat(Math.min(Number(c.stamps||0),s.r2)),empty='☆'.repeat(Math.max(0,s.r2-Number(c.stamps||0)));if(type==='welcome')return `🎉 *¡Bienvenido al Club Brinky Fiesta!* 🐸

Hola *${c.name}*. Tu registro se completó correctamente y recibiste *1 Estrella Brinky de Bienvenida*.

🌟 ${filled}${empty} (${c.stamps} de ${s.r2})
🆔 Tu código de referencia es: *${c.code}*

🎁 ${s.r1} estrellas = *${s.n1}*
🏆 ${s.r2} estrellas = *${s.n2}*

🤝 Recomienda a un amigo usando tu código de referencia y, cuando complete su renta, ambos ganan 1 Estrella Brinky.

Síguenos en Facebook: *${COMPANY.facebook}*

¡Gracias por formar parte de Brinky Fiesta! 🎈`;if(type==='referral')return `🤝 *¡Ganaste una Estrella Brinky por recomendar!*

Hola *${c.name}*. Una persona utilizó tu código *${c.code}* y tu tarjeta fue actualizada.

🌟 ${filled}${empty} (${c.stamps} de ${s.r2})

¡Sigue recomendando y acumulando recompensas! 🐸🎉`;if(type==='reward'&&r)return `🎉 *¡RECOMPENSA DESBLOQUEADA!* 🎁

Hola *${c.name}*. Ya acumulaste *${c.stamps} Estrellas Brinky* y puedes disfrutar de:

🏆 *${r.name}*

Escríbenos al realizar tu próxima reservación para aplicar tu beneficio.

Código: *${c.code}*
Facebook: *${COMPANY.facebook}*`;return `⭐ *¡Tu Tarjeta Club Brinky fue actualizada!*

Hola *${c.name}*. Acabas de recibir una nueva Estrella Brinky.

🌟 ${filled}${empty} (${c.stamps} de ${s.r2})

🎁 ${s.r1} estrellas = *${s.n1}*
🏆 ${s.r2} estrellas = *${s.n2}*

Código de referencia: *${c.code}*
Recuerda: recomienda a un amigo usando tu código y ambos ganan 1 estrella cuando complete su renta.

Facebook: *${COMPANY.facebook}*`; }
function queueLoyaltyMessage(c,type,dedupeKey=''){if(!c)return;const items=getMessages(),key=dedupeKey||`${type}-${c.id}-${c.stamps}`;if(items.some(m=>m.dedupeKey===key))return;items.unshift({id:'MSG-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),clientId:c.id,clientName:c.name,phone:c.phone,type,text:buildClubMessage(c,type),status:'pending',dedupeKey:key,createdAt:new Date().toISOString(),sentAt:null});localStorage.setItem(MESSAGES_KEY,JSON.stringify(items));updateMessageCounters()}
function updateMessageCounters(){const n=getMessages().filter(m=>m.status==='pending').length;if($('messagePendingCount'))$('messagePendingCount').textContent=n;if($('statMessages'))$('statMessages').textContent=n;const b=$('navMessageBadge');if(b){b.textContent=n;b.classList.toggle('hidden',n===0)}}
function renderMessages(){if(!$('messagesList'))return;updateMessageCounters();const q=($('searchMessages')?.value||'').toLowerCase().trim();const items=getMessages().filter(m=>(messageFilter==='all'||m.status===messageFilter)&&(!q||[m.clientName,m.phone,messageTypeLabel(m.type),m.text].some(v=>String(v||'').toLowerCase().includes(q))));$('messagesList').innerHTML=items.length?items.map(m=>`<div class="saved-item message-item"><div><div class="message-title"><span class="message-kind ${m.type}">${messageTypeLabel(m.type)}</span><strong>${escapeHtml(m.clientName||'Cliente')}</strong></div><div class="saved-meta">${escapeHtml(m.phone||'Sin teléfono')} · ${new Date(m.createdAt).toLocaleString('es-MX')}</div><p class="message-snippet">${escapeHtml(String(m.text||'').replace(/[*_]/g,'').slice(0,145))}${String(m.text||'').length>145?'…':''}</p></div><div class="saved-actions"><button class="btn btn-primary" onclick="openMessage('${m.id}')">${m.status==='pending'?'Revisar y enviar':'Ver mensaje'}</button>${m.status==='pending'?`<button class="btn btn-light" onclick="cancelMessage('${m.id}')">Descartar</button>`:''}</div></div>`).join(''):'<div class="empty">No hay mensajes en esta bandeja.</div>'}
window.openMessage=id=>{const m=getMessages().find(x=>x.id===id);if(!m)return;currentMessageId=id;$('messageTypeBadge').textContent=messageTypeLabel(m.type);$('messageClientName').textContent=m.clientName||'Cliente';$('messageClientPhone').textContent=m.phone||'Sin teléfono';$('messageEditor').value=m.text||'';$('saveMessageEdit').classList.toggle('hidden',m.status==='sent');$('sendMessageWhatsApp').classList.toggle('hidden',m.status==='sent');$('messageEditor').readOnly=m.status==='sent';$('messageModal').classList.remove('hidden')}
window.cancelMessage=id=>{if(confirm('¿Descartar este mensaje pendiente?'))setMessages(getMessages().filter(x=>x.id!==id))}
$('closeMessageModal')?.addEventListener('click',()=>$('messageModal').classList.add('hidden'));
$('saveMessageEdit')?.addEventListener('click',()=>{const items=getMessages(),i=items.findIndex(x=>x.id===currentMessageId);if(i<0)return;items[i].text=$('messageEditor').value.trim();setMessages(items);alert('Mensaje actualizado.')});
async function sharePendingClubMessage(message){
  const text=String(message.text||'').trim();
  const client=getLoyalty().find(c=>c.id===message.clientId);
  const phone=normalizedPhone(message.phone);

  if(client){
    const blob=await makeLoyaltyCardBlob(client);
    if(!blob)throw new Error('No se pudo generar la tarjeta.');
    const file=new File([blob],`Tarjeta_Club_Brinky_${client.code}.png`,{type:'image/png'});
    const shareData={title:`Tarjeta Club Brinky ${client.code}`,text,files:[file]};

    if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
      await navigator.share(shareData);
      return 'shared';
    }

    saveBlob(blob,file.name);
    const suffix='\n\n📎 La tarjeta se descargó como imagen. Adjúntala en este chat antes de enviar.';
    window.open(`https://wa.me/${phone?'52'+phone:''}?text=${encodeURIComponent(text+suffix)}`,'_blank');
    alert('Este navegador no permite adjuntar la imagen automáticamente. La tarjeta se descargó y WhatsApp se abrió con el mensaje listo.');
    return 'fallback';
  }

  window.open(`https://wa.me/${phone?'52'+phone:''}?text=${encodeURIComponent(text)}`,'_blank');
  return 'text-only';
}

$('sendMessageWhatsApp')?.addEventListener('click',async()=>{
  const items=getMessages(),i=items.findIndex(x=>x.id===currentMessageId);
  if(i<0)return;
  const btn=$('sendMessageWhatsApp'),oldLabel=btn.textContent;
  items[i].text=$('messageEditor').value.trim();
  btn.disabled=true;btn.textContent='Preparando tarjeta...';
  try{
    await sharePendingClubMessage(items[i]);
    if(confirm('¿Confirmas que la tarjeta y el mensaje fueron enviados por WhatsApp?')){
      items[i].status='sent';
      items[i].sentAt=new Date().toISOString();
      setMessages(items);
      $('messageModal').classList.add('hidden');
    }else{
      localStorage.setItem(MESSAGES_KEY,JSON.stringify(items));
    }
  }catch(error){
    if(error?.name!=='AbortError'){
      console.error(error);
      alert('No fue posible compartir la tarjeta. Intenta nuevamente o usa el botón de la tarjeta del socio.');
    }
  }finally{
    btn.disabled=false;btn.textContent=oldLabel;
  }
});
document.querySelectorAll('[data-message-filter]').forEach(b=>b.addEventListener('click',()=>{messageFilter=b.dataset.messageFilter;document.querySelectorAll('[data-message-filter]').forEach(x=>x.classList.toggle('active',x===b));renderMessages()}));
$('searchMessages')?.addEventListener('input',renderMessages);
$('clearSentMessages')?.addEventListener('click',()=>{if(confirm('¿Eliminar el historial de mensajes enviados?'))setMessages(getMessages().filter(m=>m.status!=='sent'))});
updateMessageCounters();renderMessages();
