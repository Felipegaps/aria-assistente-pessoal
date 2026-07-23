// src/components/ShoppingAgent.tsx
import React, { useEffect, useState } from 'react';
import { ShoppingItem, ShoppingType } from '../types/shopping';
import {
  addShoppingItem,
  listenShoppingList,
  markAsPending,
  markAsPurchased,
  removeShoppingItem,
} from '../services/shoppingService';
import { UserProfile } from '../types/household';

export default function ShoppingAgent({ profile }: { profile: UserProfile }) {
  const [tab, setTab] = useState<ShoppingType>('casa');
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [newLink, setNewLink] = useState('');

  useEffect(() => {
    const unsubscribe = listenShoppingList(profile.householdId, tab, setItems);
    return () => unsubscribe();
  }, [profile.householdId, tab]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;

    await addShoppingItem(profile.householdId, {
      tipo: tab,
      item: newItem.trim(),
      link: tab === 'online' && newLink.trim() ? newLink.trim() : undefined,
      uid: profile.uid,
      displayName: profile.displayName,
    });

    setNewItem('');
    setNewLink('');
  }

  const pendentes = items.filter((i) => i.status === 'pendente');
  const comprados = items.filter((i) => i.status === 'comprado');

  return (
    <div style={styles.wrapper}>
      <h1 style={styles.title}>Shopping Agent</h1>

      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(tab === 'casa' ? styles.tabActive : {}) }}
          onClick={() => setTab('casa')}
        >
          Casa
        </button>
        <button
          style={{ ...styles.tab, ...(tab === 'online' ? styles.tabActive : {}) }}
          onClick={() => setTab('online')}
        >
          Online
        </button>
      </div>

      <form onSubmit={handleAdd} style={styles.form}>
        <input
          style={styles.input}
          placeholder={tab === 'casa' ? 'Ex: Papel higiênico' : 'Ex: Tênis de corrida'}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
        />
        {tab === 'online' && (
          <input
            style={styles.input}
            placeholder="Link do produto (opcional)"
            value={newLink}
            onChange={(e) => setNewLink(e.target.value)}
          />
        )}
        <button style={styles.addButton} type="submit">
          Adicionar
        </button>
      </form>

      <section>
        <h2 style={styles.sectionTitle}>Pendentes ({pendentes.length})</h2>
        {pendentes.length === 0 && <p style={styles.empty}>Nada por aqui.</p>}
        {pendentes.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            householdId={profile.householdId}
            onTogglePurchased={() => markAsPurchased(profile.householdId, item.id)}
            onRemove={() => removeShoppingItem(profile.householdId, item.id)}
          />
        ))}
      </section>

      {comprados.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 style={styles.sectionTitle}>Comprados ({comprados.length})</h2>
          {comprados.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              householdId={profile.householdId}
              onTogglePurchased={() => markAsPending(profile.householdId, item.id)}
              onRemove={() => removeShoppingItem(profile.householdId, item.id)}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function ItemRow({
  item,
  onTogglePurchased,
  onRemove,
}: {
  item: ShoppingItem;
  householdId: string;
  onTogglePurchased: () => void;
  onRemove: () => void;
}) {
  return (
    <div style={styles.row}>
      <input
        type="checkbox"
        checked={item.status === 'comprado'}
        onChange={onTogglePurchased}
        style={styles.checkbox}
      />
      <div style={styles.rowContent}>
        <span
          style={{
            ...styles.itemName,
            ...(item.status === 'comprado' ? styles.itemNameDone : {}),
          }}
        >
          {item.item}
        </span>
        {item.link && (
          <a href={item.link} target="_blank" rel="noreferrer" style={styles.link}>
            Ver produto ↗
          </a>
        )}
        <span style={styles.meta}>adicionado por {item.adicionadoPorNome}</span>
      </div>
      <button style={styles.removeButton} onClick={onRemove}>
        ×
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { maxWidth: 560, fontFamily: 'system-ui, sans-serif', color: '#e6f7ff' },
  title: { color: '#4fd8ff', marginBottom: 16 },
  tabs: { display: 'flex', gap: 8, marginBottom: 16 },
  tab: {
    padding: '8px 16px',
    borderRadius: 8,
    border: '1px solid rgba(0, 200, 255, 0.25)',
    background: 'transparent',
    color: '#8fb3c8',
    cursor: 'pointer',
    fontSize: 13,
  },
  tabActive: {
    background: 'rgba(0, 200, 255, 0.12)',
    color: '#4fd8ff',
    fontWeight: 600,
  },
  form: { display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  input: {
    flex: 1,
    minWidth: 160,
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid rgba(0, 200, 255, 0.3)',
    background: 'rgba(255,255,255,0.03)',
    color: '#e6f7ff',
    fontSize: 13,
    outline: 'none',
  },
  addButton: {
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    background: 'linear-gradient(90deg, #00c8ff, #0072ff)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 13,
  },
  sectionTitle: { fontSize: 14, color: '#8fb3c8', marginBottom: 8 },
  empty: { fontSize: 13, color: '#5a7a8c' },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 0',
    borderBottom: '1px solid rgba(0, 200, 255, 0.08)',
  },
  checkbox: { width: 16, height: 16, cursor: 'pointer' },
  rowContent: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  itemName: { fontSize: 14 },
  itemNameDone: { textDecoration: 'line-through', color: '#5a7a8c' },
  link: { fontSize: 12, color: '#4fd8ff' },
  meta: { fontSize: 11, color: '#5a7a8c' },
  removeButton: {
    background: 'none',
    border: 'none',
    color: '#ff8080',
    fontSize: 18,
    cursor: 'pointer',
    lineHeight: 1,
  },
};
