const mailSettings = {
  mailbox: 'Mailbox access',
  send_local: 'Send to WebOS users',
  receive_external: 'Receive outside mail',
  send_external: 'Send outside mail',
};

export function mount(host) {
  const doc = host.document ?? document;
  const element = doc.createElement('section');
  element.className = 'window-content';
  const root = element.attachShadow({mode: 'open'});
  const create = (tag, text) => {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const style = create('link');
  style.rel = 'stylesheet';
  style.href = new URL('./style.css', import.meta.url);
  const nav = create('nav');
  nav.setAttribute('aria-label', 'Account settings');
  const body = create('main');
  const status = create('p');
  status.setAttribute('role', 'status');
  root.append(style, nav, body, status);
  const subject = host.storage?.signedInSubject?.();
  let closed = false;
  let page = 0;
  let me;
  function valid() { return !closed && subject && host.storage.signedInSubject() === subject; }
  async function request(operation, fields = {}) {
    const context = await host.storage.accountFileContext();
    if (!valid() || !context.valid()) throw Error('Your session ended. Sign in again.');
    const result = await context.files.request(operation, {resource: 'account-management', ...fields});
    if (!valid() || !context.valid()) throw Error('Your session ended. Sign in again.');
    return result;
  }
  function message(text) { if (!closed) status.textContent = text; }
  function action(label, callback) {
    const button = create('button', label);
    button.type = 'button';
    button.addEventListener('click', async () => {
      const current = page;
      button.disabled = true;
      message('');
      try { await callback(); }
      catch (e) { if (page === current) message(e.message || 'The request failed.'); }
      finally { button.disabled = false; }
    });
    return button;
  }
  function field(text, input) {
    const label = create('label', text);
    label.append(input);
    return label;
  }
  function input(type, autocomplete) {
    const item = create('input');
    item.type = type;
    if (autocomplete) item.autocomplete = autocomplete;
    return item;
  }
  function section(title) {
    const box = create('section');
    box.append(create('h3', title));
    body.append(box);
    return box;
  }
  function avatarCanvas(data) {
    const canvas = create('canvas');
    canvas.width = canvas.height = 64;
    canvas.setAttribute('aria-label', 'Current avatar');
    if (data) {
      const pixels = Uint8ClampedArray.from(atob(data), c => c.charCodeAt(0));
      canvas.getContext('2d').putImageData(new ImageData(pixels, 64, 64), 0, 0);
    }
    return canvas;
  }
  async function upload(file) {
    if (!file || !['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024)
      throw Error('Choose a PNG, JPEG or WebP image under 4 MiB.');
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = avatarCanvas(null);
      const ctx = canvas.getContext('2d');
      const side = Math.min(bitmap.width, bitmap.height);
      ctx.drawImage(bitmap, (bitmap.width-side)/2, (bitmap.height-side)/2, side, side, 0, 0, 64, 64);
      const raw = ctx.getImageData(0,0,64,64).data;
      await request('avatar', {rgba: btoa(String.fromCharCode(...raw))});
    } finally { bitmap.close(); }
  }
  async function personal() {
    const current = ++page;
    const profile = await request('self');
    if (current !== page) return;
    me = profile;
    nav.replaceChildren(action('My account', personal));
    if (me.permissions.includes('users.read')) nav.append(action('Manage users', manage));
    body.replaceChildren(create('h2', 'My account'), create('p', me.username));
    const profileBox = section('Profile');
    const name = input('text','nickname');
    name.value = me.displayName;
    name.maxLength = 64;
    if (me.canEditName) profileBox.append(field('Display name', name), action('Save name', async () => {
      await request('display-name', {name:name.value}); message('Display name saved.');
    }));
    else profileBox.append(create('p', me.displayName));
    const photo = section('Avatar');
    if (me.avatar) photo.append(avatarCanvas(me.avatar));
    const file = input('file');
    file.accept = 'image/png,image/jpeg,image/webp';
    photo.append(field('Profile image', file), action('Save avatar', async () => {
      await upload(file.files[0]); if (page===current) await personal(); message('Avatar saved.');
    }));
    if (me.avatar) photo.append(action('Remove avatar', async () => {
      await request('avatar', {rgba:null}); if (page===current) await personal(); message('Avatar removed.');
    }));
    const passwords = section('Password');
    const old = input('password','current-password');
    const next = input('password','new-password');
    const repeat = input('password','new-password');
    passwords.append(field('Current password',old),field('New password',next),field('Confirm new password',repeat),
      action('Change password',async () => {
        if (next.value !== repeat.value) throw Error('New passwords must match.');
        await request('password',{current:old.value,password:next.value});
        body.replaceChildren(); nav.replaceChildren(); message('Password changed. Sign in again.');
      }));
  }
  function manage() {
    const current = ++page;
    body.replaceChildren(create('h2','Manage users'));
    const search = input('search');
    const results = create('ul');
    const detail = create('section');
    let selection = 0;
    async function find() {
      const id = ++selection;
      const {users} = await request('search',{query:search.value});
      if (page!==current || id!==selection) return;
      detail.replaceChildren();
      results.replaceChildren();
      for (const u of users) {
        const li = create('li');
        li.append(action(u.username,async () => {
          const key=++selection;
          const user=await request('inspect',{target:u.subject});
          if (page===current && key===selection) render(user,key);
        }));
        results.append(li);
      }
      message(users.length ? '' : 'No matching users.');
    }
    const submit=action('Search',find);
    search.addEventListener('keydown',e=>{if(e.key==='Enter') submit.click();});
    body.append(field('Find by username',search),submit,results,detail);
    function render(user,key) {
      detail.replaceChildren(create('h3',user.username));
      const can = p=>me.permissions.includes(p);
      const target=user.subject;
      const updated = data=>{if(page===current && selection===key) render(data,key);};
      function toggle(title, value, permission, op, fields={}) {
        const check=input('checkbox');
        check.checked=value;
        check.disabled=!can(permission);
        check.addEventListener('change',async () => {
          const enabled=check.checked;
          if (op==='retention' && !enabled && !window.confirm('The next scheduled reset deletes this account, its Files and its mailbox. Its address can then be used again. Continue?')) {
            check.checked=true;return;
          }
          if (op==='suspend' && enabled && !window.confirm('Suspend sign-in and revoke this account’s sessions?')) {
            check.checked=false;return;
          }
          check.disabled=true;
          try {updated(await request(op,{target,enabled,...fields}));message(op==='mail'?'Mail request saved for the mail operator.':'Setting saved.');}
          catch(e){check.checked=value;check.disabled=!can(permission);message(e.message);}
        });
        const label=create('label');
        label.className='toggle';
        label.append(check,doc.createTextNode(title));detail.append(label);
      }
      toggle('Suspend sign-in',user.suspended,'users.suspend','suspend');
      toggle('Keep across resets',user.retained,'retention.manage','retention');
      if (can('users.reset')) detail.append(action('Issue password reset code',async () => {
        const result=await request('issue-reset',{target});
        if (selection!==key || page!==current) return;
        const output=create('output',result.code);
        const link=create('a','Password reset page');
        link.href='/api/accounts/reset';link.target='_blank';link.rel='noopener noreferrer';
        detail.append(create('p','Share this one-time code privately. It expires in 15 minutes.'),output, link);
      }));
      detail.append(create('h3','Requested mail settings'),create('p','The mail operator applies these requests. Delivery and sending follow the settings installed on the mail server.'));
      for (const [setting,title] of Object.entries(mailSettings))
        toggle(title,user.requestedMail.includes(setting),'mail.manage','mail',{setting});
    }
  }
  if (subject) personal().catch(e=>message(e.message));
  else message('Sign in to use Account Management.');
  return {element,dispose(){closed=true;page++;root.replaceChildren();}};
}
