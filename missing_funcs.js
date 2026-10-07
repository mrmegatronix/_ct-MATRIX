    function renderDashboardHome() {
        const wrap = document.getElementById('operator-wrap');
        
        // Load current durations from config
        let config = { moduleDurations: {} };
        try {
            const stored = localStorage.getItem('matrix_config');
            if (stored) config = { ...config, ...JSON.parse(stored) };
        } catch(e) {}
        const dur = config.moduleDurations || {};

        const modules = [
            { id: 'ct-matrix', name: 'MATRIX', defaultDuration: 30 },
            { id: 'ct-ace2', name: 'ACE 2', defaultDuration: 180 },
            { id: 'ct-mmr', name: 'MMR', defaultDuration: 600 },
            { id: 'ct-quiz', name: 'QUIZ', defaultDuration: 60 },
            { id: 'ct-wea1', name: 'WEA1', defaultDuration: 60 },
            { id: 'ct-fir', name: 'FIR', defaultDuration: 180 },
            { id: 'ct-soc', name: 'SOC', defaultDuration: 120 },
            { id: 'ct-tik', name: 'TIK', defaultDuration: 30 },
            { id: 'ct-faceb', name: 'FACEB', defaultDuration: 30 },
            { id: 'ct-insta', name: 'INSTA', defaultDuration: 30 },
            { id: 'ct-loyalty', name: 'LOYALTY', defaultDuration: 60 },
            { id: 'ct-trip', name: 'TRIP', defaultDuration: 60 }
        ];

        const durationRows = modules.map(m => {
            const finalDur = config.moduleDurations && config.moduleDurations[m.id] ? config.moduleDurations[m.id] : 'all';
            const isAll = finalDur === 'all';
            return `
                <div style="background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 6px 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px; backdrop-filter: blur(12px);">
                    <div style="font-weight: 800; font-size: 0.85rem; color: var(--text); min-width: 70px;">
                        ${m.name}
                    </div>
                    
                    <div style="display:flex; align-items:center; gap:8px; flex:1; justify-content: flex-end;">
                        <div id="home-dur-container-${m.id}" style="display:${isAll ? 'none' : 'flex'}; align-items:center; background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
                            <input type="number" id="home-dur-${m.id}" value="${isAll ? m.defaultDuration : finalDur}" min="10" max="9999" onchange="saveHomeModuleDurations()" style="width: 50px; background: transparent; border: none; border-bottom: 2px solid var(--accent); color: #fff; padding: 2px; text-align: center; font-weight: bold; outline: none; font-size: 0.9rem; transition: 0.2s;" onfocus="this.style.borderColor='#fff'" onblur="this.style.borderColor='var(--accent)'">
                            <span style="font-size: 0.6rem; color: #555; font-weight: 800; margin-left: 4px;">SEC</span>
                        </div>
                        <div id="home-dur-all-msg-${m.id}" style="display:${isAll ? 'flex' : 'none'}; align-items: center; justify-content: center; font-size: 0.65rem; color: var(--accent); font-weight: 800; opacity: 0.8; background: rgba(6, 182, 212, 0.05); border-radius: 6px; border: 1px dashed rgba(6, 182, 212, 0.2); padding: 6px 10px; width: 80px;">
                            LOOP
                        </div>
                        
                        <label style="display:flex; align-items:center; gap: 4px; font-size: 0.65rem; color: #fff; cursor: pointer; background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); transition: 0.2s; margin:0;" onmouseover="this.style.background='rgba(0,0,0,0.5)'" onmouseout="this.style.background='rgba(0,0,0,0.3)'">
                            <input type="checkbox" id="home-all-${m.id}" ${isAll ? 'checked' : ''} onchange="toggleHomePlayAll('${m.id}', this.checked); saveHomeModuleDurations(); document.getElementById('home-dur-all-msg-${m.id}').style.display = this.checked ? 'flex' : 'none';" style="margin:0; width:12px; height:12px; accent-color: var(--accent);">
                            <span>ALL</span>
                        </label>
                    </div>
                </div>
            `;
        }).join('');
        
        wrap.innerHTML = `
            <div style="padding: 1.5rem; height: 100%; overflow-y: auto; box-sizing: border-box;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
                    <div>
                        <div style="font-size: 1.4rem; font-weight: 900; letter-spacing: -0.5px;">DASHBOARD HOME</div>
                        <div style="font-size: 0.75rem; color: #888; margin-top: 2px;">Manage rotation durations and access quick operator actions.</div>
                    </div>
                    <div style="display:flex; gap: 10px;">
                        <button class="ctrl-btn primary" onclick="requestTelemetry()">Refresh Telemetry</button>
                        <button class="ctrl-btn" onclick="loadModule('COMMANDER', 'matrixcommander.html?compact=true&v=' + Date.now())">Matrix Commander</button>
                        <button class="ctrl-btn" onclick="window.open('remote.html', '_blank')" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; border-color: rgba(245, 158, 11, 0.5);">Open Remote</button>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 280px; gap: 1.5rem; align-items: start;">
                    <div class="panel" style="padding: 1rem; background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; backdrop-filter: blur(24px);">
                        <div style="font-size: 0.8rem; font-weight: 800; color: var(--text-dim); margin-bottom: 0.8rem; letter-spacing: 1px; text-transform: uppercase;">Module Rotation (Seconds)</div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px;">
                            ${durationRows}
                        </div>
                    </div>

                    <div class="panel" style="padding: 1.5rem; background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; backdrop-filter: blur(24px);">
                        <div style="font-size: 0.75rem; font-weight: 800; opacity: 0.8; margin-bottom: 1.5rem; text-transform: uppercase; letter-spacing: 1px; color: var(--accent);">Quick Actions</div>
                        <button class="ctrl-btn primary" style="width: 100%; margin-bottom: 12px; justify-content: center; padding: 12px;" onclick="requestTelemetry()">Refresh Telemetry</button>
                        <button class="ctrl-btn" style="width: 100%; margin-bottom: 12px; justify-content: center; padding: 12px;" onclick="window.open('remote.html', '_blank')">📱 Open Remote Control</button>
                        <button class="ctrl-btn" style="width: 100%; margin-bottom: 12px; justify-content: center; padding: 12px;" onclick="loadModule('COMMANDER', 'matrixcommander.html?compact=true&v=' + Date.now())">Open Matrix Commander</button>
                        <button class="ctrl-btn" style="width: 100%; margin-bottom: 12px; justify-content: center; padding: 12px;" onclick="loadWorkspaceView('SCHEDULES')">Module Schedules</button>
                        <button class="ctrl-btn" style="width: 100%; justify-content: center; padding: 12px;" onclick="loadWorkspaceView('PLAYLIST')">Playlist Grid View</button>
                    </div>
                </div>

                <div style="margin-top: 2rem; opacity: 0.3; font-size: 0.7rem; text-align: center; font-weight: 800; letter-spacing: 2px;">
                    SELECT A MODULE FROM THE NAVIGATION TO BEGIN OPERATING
                </div>
            </div>
        `;
        document.getElementById('ctrl-title').innerText = 'DASHBOARD HOME';
        document.getElementById('ctrl-url').innerText = 'CORE';
        
        const ctx = document.getElementById('context-links');
        if (ctx) ctx.innerHTML = '';
        
        // Request metrics telemetry
        requestTelemetry();
        renderSidebarToggles();
        renderMonitorTray();
    }

        function timeToDec(timeStr) {
            if (!timeStr) return 0;
            const parts = timeStr.split(':');
            return parseInt(parts[0], 10) + parseInt(parts[1], 10) / 60;
        }
