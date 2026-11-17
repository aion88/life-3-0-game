import references from './resources.json';

/** No remote request: external resources are opened only when the reader follows a link. */
export function createResources(doc:Document):HTMLElement {
 const section=doc.createElement('section');section.className='life-resources';section.id='ressources';section.setAttribute('aria-labelledby','life-resources-title');
 const title=doc.createElement('h2');title.id='life-resources-title';title.textContent='Ressources';
 const intro=doc.createElement('p');intro.textContent='Les lectures, études, enquêtes et références visuelles réunies pour concevoir le jeu. Les faits présentés en partie sont distingués de la bibliothèque de recherche : une référence recensée n’est pas une prédiction ni une validation de tous ses arguments.';
 const search=doc.createElement('input');search.type='search';search.placeholder='Rechercher un sujet, un titre ou un site';search.setAttribute('aria-label','Rechercher dans les ressources');
 const count=doc.createElement('p');count.className='life-resource-count';count.setAttribute('role','status');
 const list=doc.createElement('div');list.className='life-resource-groups';
 const groups=[...new Set(references.map(r=>r.group))];
 const render=():void=>{
  const query=search.value.trim().toLocaleLowerCase('fr');
  const filtered=references.filter(r=>[r.title,r.domain,r.group,...r.origins].join(' ').toLocaleLowerCase('fr').includes(query));
  count.textContent=`${filtered.length} ressource${filtered.length===1?'':'s'}${query?` sur ${references.length}`:''}`;
  list.replaceChildren();
  for(const group of groups){
   const items=filtered.filter(r=>r.group===group);if(!items.length)continue;
   const details=doc.createElement('details');details.open=Boolean(query)||group==='Pour commencer';
   const summary=doc.createElement('summary');summary.textContent=`${group} · ${items.length}`;details.append(summary);
   const ul=doc.createElement('ul');
   for(const item of items){
    const li=doc.createElement('li');const a=doc.createElement('a');a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=item.title;
    const context=doc.createElement('span');context.textContent=item.domain;context.className='life-resource-domain';
    li.append(a,context);ul.append(li);
   }
   details.append(ul);list.append(details);
  }
 };
 search.addEventListener('input',render);render();section.append(title,intro,search,count,list);return section;
}
