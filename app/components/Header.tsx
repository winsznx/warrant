"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { Wallet, LogOut, ChevronDown, AlertTriangle, Menu, X } from "lucide-react";
import { ACTIVE_CHAIN, ACTIVE_CHAIN_ID } from "@/lib/config";
import { useCusdBalance } from "@/lib/warrants";
import { isMiniPay } from "@/lib/minipay";
import { truncateAddress } from "@/lib/format";
import { useMounted } from "@/lib/useMounted";

const NAV = [
  { href: "/", label: "Home", match: (p: string) => p === "/" },
  { href: "/create", label: "Create", match: (p: string) => p === "/create" },
  {
    href: "/warrants",
    label: "Dashboard",
    match: (p: string) => p.startsWith("/warrants") || p.startsWith("/warrant/"),
  },
  { href: "/agent", label: "Agent", match: (p: string) => p === "/agent" },
];

export default function Header() {
  const pathname = usePathname();
  const mounted = useMounted();
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { formatted } = useCusdBalance(address);

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const autoConnected = useRef(false);

  // Auto-connect inside MiniPay, which expects Mini Apps to connect on load.
  useEffect(() => {
    if (autoConnected.current || isConnected || !isMiniPay()) return;
    const injectedConnector = connectors.find((c) => c.type === "injected" || c.id === "injected");
    if (injectedConnector) {
      autoConnected.current = true;
      connect({ connector: injectedConnector });
    }
  }, [isConnected, connectors, connect]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => setMobileNavOpen(false), [pathname]);

  const wrongNetwork = isConnected && chainId !== ACTIVE_CHAIN_ID;

  function handleConnectClick() {
    if (connectors.length === 1) {
      connect({ connector: connectors[0] });
      return;
    }
    setMenuOpen((v) => !v);
  }

  return (
    <header className="navbar">
      <Link href="/" className="nav-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Warrant"
          style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1.5px solid var(--primary-gold)" }}
        />
        <span>Warrant</span>
      </Link>

      <nav className="nav-links">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className={`nav-link ${item.match(pathname) ? "active" : ""}`}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        {wrongNetwork ? (
          <button
            onClick={() => switchChain({ chainId: ACTIVE_CHAIN_ID })}
            className="btn"
            disabled={isSwitching}
            style={{ padding: "8px 16px", borderRadius: "9999px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "var(--error-red)" }}
          >
            <AlertTriangle size={14} />
            <span>{isSwitching ? "Switching…" : `Switch to ${ACTIVE_CHAIN.name}`}</span>
          </button>
        ) : (
          <div
            className="btn btn-secondary chain-chip"
            style={{ padding: "8px 16px", borderRadius: "9999px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px", cursor: "default" }}
          >
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--success-green)" }} />
            <span>{ACTIVE_CHAIN.name}</span>
          </div>
        )}

        {!mounted ? (
          <div className="btn btn-primary" style={{ padding: "8px 20px", borderRadius: "9999px", fontSize: "0.85rem", opacity: 0.6 }}>
            <Wallet size={14} />
            <span>Connect</span>
          </div>
        ) : isConnected && address ? (
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <div
              className="btn btn-primary"
              style={{ padding: "8px 16px", borderRadius: "9999px", fontSize: "0.85rem", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: "8px", cursor: "default" }}
            >
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--success-green)", boxShadow: "0 0 8px var(--success-green)" }} />
              <span>{formatted} cUSD</span>
              <span style={{ opacity: 0.5 }}>·</span>
              <span>{truncateAddress(address)}</span>
            </div>
            <button onClick={() => disconnect()} className="btn btn-secondary wallet-disconnect" title="Disconnect" style={{ padding: "8px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LogOut size={14} style={{ color: "var(--error-red)" }} />
            </button>
          </div>
        ) : (
          <div ref={menuRef} style={{ position: "relative" }}>
            <button
              onClick={handleConnectClick}
              className="btn btn-primary"
              disabled={isPending}
              style={{ padding: "8px 20px", borderRadius: "9999px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "8px" }}
            >
              <Wallet size={14} />
              <span>{isPending ? "Connecting…" : "Connect"}</span>
              {connectors.length > 1 && <ChevronDown size={14} />}
            </button>

            {menuOpen && connectors.length > 1 && (
              <div className="glass-card" style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, padding: "8px", minWidth: "200px", display: "flex", flexDirection: "column", gap: "4px", zIndex: 50 }}>
                {connectors.map((connector) => (
                  <button
                    key={connector.uid}
                    onClick={() => {
                      connect({ connector });
                      setMenuOpen(false);
                    }}
                    className="nav-link"
                    style={{ textAlign: "left", padding: "10px 12px", borderRadius: "10px", background: "transparent", border: "none", cursor: "pointer", fontSize: "0.9rem" }}
                  >
                    {connector.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          className="nav-burger"
          aria-label="Menu"
          onClick={() => setMobileNavOpen((v) => !v)}
        >
          {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileNavOpen && (
        <div className="mobile-nav">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${item.match(pathname) ? "active" : ""}`}
              style={{ padding: "12px 14px" }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
