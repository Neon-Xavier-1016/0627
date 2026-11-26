(() => {
    const key = 'stickerLibraryShared';
    const warnAt = 50 * 1024 * 1024;
    let ready = false, writing = Promise.resolve(), uploadRole;
    let records = new Map(), disabled = new Set(), committed = [];
    const roles = () => window.XavierConversations?.profiles() || [];
    const original = () => window.XavierConversations?.primaryId();
    const active = () => window.XavierConversations?.activeId() || original();
    const embedded = value => /^data:image\/[a-z0-9.+-]+;base64,/i.test(value);
    const valid = value => typeof value === 'string' && /^(?:data:image\/|https?:\/\/|(?:\.\/)?image\/)/i.test(value) && !/["'<>]/.test(value);
    const scopeFor = src => records.get(src)?.roles ?? (records.has(src) ? null : [original()].filter(Boolean));
    const bytes = src => {
        if (!embedded(src)) return 0;
        const base64 = src.slice(src.indexOf(',') + 1).replace(/\s/g, '');
        return Math.floor(base64.length * 3 / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
    };
    const readable = count => count < 1048576 ? (count / 1024).toFixed(0) + ' KB' : (count / 1048576).toFixed(1) + ' MB';
    const report = error => {console.error('[表情库]', error); showNotification('表情库保存失败，请重试。', 'error');};
    const distinct = items => [...new Set(items.filter(valid))];

    function snapshot() {
        const mine = new Set(distinct(window.myStickerLibrary || []));
        const partner = new Set(distinct(stickerLibrary || []));
        return [...new Set([...mine, ...partner])].map(src => ({
            src, mine: mine.has(src), partner: partner.has(src), roles: partner.has(src) ? scopeFor(src) : [],
            disabled: partner.has(src) && disabled.has(src)
        }));
    }

    function save() {
        if (!ready) return Promise.resolve();
        const items = snapshot();
        const storageKey = getStorageKey(key);
        writing = writing.catch(() => {}).then(async () => {
            const unchanged = items.length === committed.length && items.every((item, index) => {
                const old = committed[index];
                return item.src === old.src && item.mine === old.mine && item.partner === old.partner &&
                    item.disabled === old.disabled && JSON.stringify(item.roles) === JSON.stringify(old.roles);
            });
            if (!unchanged) {
                await localforage.setItem(storageKey, items);
                committed = items;
            }
            const registered = new Set(stickerLibrary);
            for (const src of records.keys()) if (!registered.has(src)) records.delete(src);
        });
        return writing;
    }

    async function init() {
        const stored = await localforage.getItem(getStorageKey(key));
        if (Array.isArray(stored)) {
            records = new Map(stored.filter(item => valid(item?.src)).map(item => [item.src, item]));
            committed = [...records.values()];
            disabled = new Set(committed.filter(item => item.disabled).map(item => item.src));
            stickerLibrary = distinct([...stored.filter(item => item?.partner).map(item => item.src), ...(stickerLibrary || [])]);
            window.myStickerLibrary = distinct([...stored.filter(item => item?.mine).map(item => item.src), ...(window.myStickerLibrary || [])]);
        } else {
            stickerLibrary = distinct(stickerLibrary || []);
            window.myStickerLibrary = distinct(window.myStickerLibrary || []);
        }
        try {
            const legacyDisabled = JSON.parse(localStorage.getItem('disabledStickerItems') || '[]');
            if (Array.isArray(legacyDisabled)) legacyDisabled.forEach(src => disabled.add(src));
        } catch {}
        window.stickerLibrary = stickerLibrary;
        ready = true;
        await save();
        await Promise.all(['stickerLibrary','myStickerLibrary'].map(suffix => localforage.removeItem(getStorageKey(suffix))));
        localStorage.removeItem('disabledStickerItems');
    }

    function available(id = active()) {
        return (stickerLibrary || []).filter(src => {
            const scope = scopeFor(src);
            return !disabled.has(src) && (scope === null || scope.includes(id));
        });
    }

    function assignSelected(sources, scope) {
        const selected = new Set(sources);
        const roleIds = roles().map(person => person.id);
        const targets = new Set(scope ?? roleIds);
        for (const src of stickerLibrary) {
            const previous = scopeFor(src);
            const keep = selected.has(src);
            if (scope === null) {
                records.set(src, { roles: keep ? null : [] });
            } else if (keep) {
                if (previous !== null) records.set(src, { roles: [...new Set([...previous, ...targets])] });
            } else if (previous === null || previous.some(id => targets.has(id))) {
                records.set(src, { roles: (previous ?? roleIds).filter(id => !targets.has(id)) });
            }
        }
    }

    function scopeButton(sources, label = '使用范围', { replaceForRoles = false } = {}) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'xv-asset-button';
        button.textContent = label;
        button.onclick = event => {
            event.stopPropagation();
            const first = replaceForRoles ? [active()].filter(Boolean) : scopeFor(sources[0]);
            chooseScope('表情使用范围', first, async scope => {
                const previous = new Map(records);
                if (replaceForRoles) assignSelected(sources, scope);
                else sources.forEach(src => records.set(src, {roles:scope}));
                try { await save(); }
                catch (error) { records = previous; throw error; }
                renderReplyLibrary();
                if (document.querySelector('#user-sticker-picker.active .combo-tab-btn.active[data-tab="partner-sticker"]')) {
                    renderComboMenu();
                }
            }, true, replaceForRoles ? '保存后，所选角色的表情列表只保留本次勾选的图片。' : '');
        };
        return button;
    }

    function chooseScope(title, current, onSave, allowAll = true, description = '') {
        const dialog = document.createElement('dialog');
        dialog.className = 'xv-asset-dialog';
        const heading = document.createElement('h2');
        heading.textContent = title;
        heading.id = 'xv-asset-dialog-title';
        dialog.setAttribute('aria-labelledby', heading.id);
        dialog.append(heading);
        if (description) {
            const note = document.createElement('p');
            note.textContent = description;
            dialog.append(note);
        }
        const choices = document.createElement('div');
        choices.className = 'xv-asset-choices';
        dialog.append(choices);
        const entries = [{id:'*', name:'所有梦角（包括以后添加的）'}, ...roles()];
        const fields = [];
        for (const item of entries) {
            if (item.id === '*' && !allowAll) continue;
            const label = document.createElement('label');
            if (item.id === '*') label.className = 'xv-asset-all';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.value = item.id;
            input.checked = current === null ? item.id === '*' : current.includes(item.id);
            const tile = document.createElement('span');
            tile.className = 'xv-asset-choice';
            tile.textContent = item.name;
            label.append(input, tile);
            choices.append(label);
            fields.push(input);
        }
        const all = fields.find(input => input.value === '*');
        const footer = document.createElement('div');
        footer.className = 'xv-asset-footer';
        const cancel = document.createElement('button');
        cancel.type = 'button'; cancel.textContent = '取消'; cancel.onclick = () => dialog.close();
        const apply = document.createElement('button');
        apply.type = 'button'; apply.textContent = '保存';
        let saving = false;
        const sync = () => {
            fields.forEach(input => { if (input !== all) input.disabled = Boolean(all?.checked); });
            apply.disabled = saving || (Boolean(description) && !fields.some(input => input.checked));
        };
        choices.addEventListener('change', sync);
        sync();
        apply.onclick = async () => {
            saving = true;
            sync();
            try {
                await onSave(all?.checked ? null : fields.filter(input => input !== all && input.checked).map(input => input.value));
                dialog.close();
            } catch (error) { report(error); }
            finally { saving = false; sync(); }
        };
        footer.append(cancel, apply);
        dialog.append(footer);
        dialog.addEventListener('close', () => dialog.remove(), {once:true});
        document.body.append(dialog);
        dialog.showModal();
    }

    function scopeLabel(src) {
        const scope = scopeFor(src);
        if (scope === null) return '所有梦角';
        return roles().filter(person => scope.includes(person.id)).map(person => person.name).join('、') || '未分配';
    }

    function summary() {
        const items = snapshot().sort((a, b) => bytes(b.src) - bytes(a.src));
        const total = items.reduce((sum, item) => sum + bytes(item.src), 0);
        const section = document.createElement('div');
        section.className = 'xv-asset-summary';
        section.append(document.createTextNode('共 ' + items.length + ' 张 · 本地图片约 ' + readable(total)));
        if (total >= warnAt) {
            const details = document.createElement('details');
            const title = document.createElement('summary');
            title.textContent = '占用已超过 50 MB · 查看最大的表情';
            details.append(title);
            for (const item of items.slice(0, 5)) {
                const row = document.createElement('div');
                const image = document.createElement('img');
                image.src = item.src; image.alt = ''; image.loading = 'lazy';
                row.append(image, document.createTextNode(readable(bytes(item.src))));
                details.append(row);
            }
            section.append(details);
        }
        return section;
    }

    function prepareUpload(input, id = active()) {
        uploadRole = id;
        input.click();
    }

    async function fileData(file) {
        const source = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        if (file.type !== 'image/jpeg' && file.type !== 'image/png') return source;
        if (file.type === 'image/png' && atob(source.slice(source.indexOf(',') + 1)).includes('acTL')) return source;
        try {
            const image = new Image();
            image.src = source;
            await image.decode();
            const scale = Math.min(1, 480 / Math.max(image.width, image.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));
            canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
            const compressed = canvas.toDataURL('image/webp', 0.82);
            return valid(compressed) && compressed.length < source.length ? compressed : source;
        } catch { return source; }
    }

    async function addFiles(files, target) {
        const id = uploadRole || active();
        if (target === 'partner') uploadRole = null;
        let added = 0;
        for (const file of files) {
            if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') continue;
            if (file.size > MAX_IMAGE_SIZE) {showNotification('「' + file.name + '」超过单张 5 MB', 'warning'); continue;}
            const src = await fileData(file);
            if (!valid(src)) continue;
            const pool = target === 'partner' ? stickerLibrary : window.myStickerLibrary;
            if (pool.includes(src)) {
                const scope = scopeFor(src);
                if (target === 'partner' && id && scope && !scope.includes(id)) {
                    records.set(src, {roles:[...scope, id]});
                    added++;
                }
                continue;
            }
            if (target === 'partner') records.set(src, {roles:[id].filter(Boolean)});
            pool.push(src);
            added++;
        }
        await save();
        return added;
    }

    async function removeMine(src) {
        if (!ready) throw new Error('表情库尚未加载');
        const pool = window.myStickerLibrary;
        const index = pool.indexOf(src);
        if (index === -1) return false;
        pool.splice(index, 1);
        try {
            await save();
            return true;
        } catch (error) {
            if (window.myStickerLibrary === pool && !pool.includes(src)) {
                pool.splice(index, 0, src);
            }
            throw error;
        }
    }

    window.StickerAssets = {init, save, available, chooseScope, scopeLabel, scopeButton, summary, prepareUpload, addFiles, removeMine,
        getDisabled: () => new Set(disabled),
        setDisabled: selection => { disabled = new Set(selection); save().catch(report); },
        exportPartner: () => stickerLibrary.map(src => ({src, roles:scopeFor(src), disabled:disabled.has(src)})),
        restorePartner: (items, overwrite) => {
            if (overwrite) stickerLibrary = [];
            for (const item of items) {
                const src = typeof item === 'string' ? item : item?.src;
                if (!valid(src)) continue;
                if (typeof item !== 'string') records.set(src, {roles:item.roles === null ? null : (Array.isArray(item.roles) ? item.roles : [original()].filter(Boolean))});
                if (item?.disabled) disabled.add(src);
                if (!stickerLibrary.includes(src)) stickerLibrary.push(src);
            }
            window.stickerLibrary = stickerLibrary;
        }
    };
})();
