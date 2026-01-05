interface ShortcutsModalProps {
  onClose: () => void;
}

const shortcuts = [
  {
    group: 'Playback',
    items: [
      { description: 'Play / Pause', keys: ['Space', 'K'] },
      { description: 'Rewind 10 seconds', keys: ['←', 'J'] },
      { description: 'Forward 10 seconds', keys: ['→', 'L'] },
      { description: 'Decrease speed', keys: ['<'] },
      { description: 'Increase speed', keys: ['>'] },
      { description: 'Previous frame (paused)', keys: [','] },
      { description: 'Next frame (paused)', keys: ['.'] }
    ]
  },
  {
    group: 'Volume',
    items: [
      { description: 'Volume up', keys: ['↑'] },
      { description: 'Volume down', keys: ['↓'] },
      { description: 'Mute / Unmute', keys: ['M'] }
    ]
  },
  {
    group: 'Navigation',
    items: [
      { description: 'Toggle fullscreen', keys: ['F'] },
      { description: 'Seek to 0% - 90%', keys: ['0-9'] },
      { description: 'Show shortcuts', keys: ['?'] }
    ]
  }
];

export default function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  return (
    <div className="shortcuts-modal-overlay" onClick={onClose}>
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-modal-header">
          <h3>Keyboard Shortcuts</h3>
          <button className="settings-close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
            </svg>
          </button>
        </div>
        <div className="shortcuts-modal-content">
          {shortcuts.map((group) => (
            <div key={group.group} className="shortcuts-group">
              <div className="shortcuts-group-title">{group.group}</div>
              <div className="shortcuts-list">
                {group.items.map((item, index) => (
                  <div key={index} className="shortcut-item">
                    <span className="shortcut-description">{item.description}</span>
                    <div className="shortcut-keys">
                      {item.keys.map((key, keyIndex) => (
                        <span key={keyIndex} className="shortcut-key">{key}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

