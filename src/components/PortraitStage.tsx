import React, { useEffect, useState } from 'react';
import { Sparkles, Heart } from 'lucide-react';
import { CharacterData, CharacterRuntimeState, EmotionState } from '../types/game';
import { getAffectionStage } from '../engine/gameEngine';
import { PORTRAITS } from '../data/portraits';

interface PortraitStageProps {
  character: CharacterData;
  runtime: CharacterRuntimeState;
  relationshipLabel: string;
}

const EMOTION_META: Record<
  EmotionState,
  { label: string; badgeClass: string; auraOpacity: string }
> = {
  normal: {
    label: '神色淡然',
    badgeClass: 'border-[#c5a059]/40 text-[#e2c488] bg-[#181b22]/90',
    auraOpacity: '0.35',
  },
  smile: {
    label: '眉眼含笑',
    badgeClass: 'border-emerald-400/50 text-emerald-300 bg-emerald-950/60',
    auraOpacity: '0.5',
  },
  shy: {
    label: '双颊微赧',
    badgeClass: 'border-pink-400/50 text-pink-300 bg-pink-950/60',
    auraOpacity: '0.55',
  },
  angry: {
    label: '柳眉倒竖',
    badgeClass: 'border-red-500/60 text-red-300 bg-red-950/70',
    auraOpacity: '0.6',
  },
  injured: {
    label: '气血受损',
    badgeClass: 'border-amber-500/60 text-amber-300 bg-amber-950/70',
    auraOpacity: '0.25',
  },
  blackened: {
    label: '道心黑化',
    badgeClass: 'border-purple-500/70 text-purple-300 bg-purple-950/80',
    auraOpacity: '0.75',
  },
};

export const PortraitStage: React.FC<PortraitStageProps> = ({
  character,
  runtime,
  relationshipLabel,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const portraitSrc = PORTRAITS[character.id] ?? `/portraits/${character.id}_${runtime.emotion}.png`;

  useEffect(() => {
    setImgFailed(false);
  }, [portraitSrc]);

  const emotionMeta = EMOTION_META[runtime.emotion] ?? EMOTION_META.normal;
  const affStage = getAffectionStage(runtime.affection);

  return (
    <div className="xuan-card rounded-xl p-4 flex flex-col justify-between h-full relative overflow-hidden">
      {/* Subtle Ambient Aura */}
      <div
        className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl transition-all duration-700"
        style={{
          backgroundColor:
            runtime.emotion === 'blackened' ? '#7e22ce' : character.themeColor,
          opacity: Number(emotionMeta.auraOpacity) * 0.25,
        }}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-2 z-10">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold tracking-wide text-[#e2c488]">
              {character.name}
            </h3>
            <span
              className="text-[11px] px-2 py-0.5 rounded border"
              style={{
                borderColor: `${character.themeColor}55`,
                color: character.themeColor,
                backgroundColor: `${character.themeColor}14`,
              }}
            >
              {character.styleTag}
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-0.5">{character.title}</p>
        </div>

        <span
          className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-all duration-300 ${emotionMeta.badgeClass}`}
        >
          {emotionMeta.label}
        </span>
      </div>

      {/* Half-body Portrait Stage */}
      <div className="relative my-3 flex-1 min-h-[270px] rounded-lg border border-[#c5a059]/25 bg-[#0b0d11] overflow-hidden flex items-center justify-center">
        {!imgFailed ? (
          <img
            key={portraitSrc}
            src={portraitSrc}
            alt={`${character.name} - ${emotionMeta.label}`}
            onError={() => setImgFailed(true)}
            className="w-full aspect-[2/3] object-cover object-top"
          />
        ) : (
          <div
            key={`${character.id}_${runtime.emotion}_svg`}
            className="w-full h-full flex flex-col items-center justify-center relative animate-fade-in select-none"
          >
            {/* Ink-wash Mountain & Moon Backdrop */}
            <svg
              viewBox="0 0 300 340"
              className="w-full h-full max-h-[310px] animate-float-slow"
              aria-label={`${character.name} 水墨艺术立绘`}
            >
              <defs>
                <radialGradient id={`halo_${character.id}`} cx="50%" cy="34%" r="45%">
                  <stop
                    offset="0%"
                    stopColor={
                      runtime.emotion === 'blackened'
                        ? '#a855f7'
                        : character.themeColor
                    }
                    stopOpacity="0.32"
                  />
                  <stop offset="100%" stopColor="#0b0d11" stopOpacity="0" />
                </radialGradient>
                <linearGradient id={`robe_${character.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1e222c" />
                  <stop offset="65%" stopColor="#12151c" />
                  <stop offset="100%" stopColor="#090a0d" />
                </linearGradient>
                <linearGradient id={`silk_${character.id}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={character.themeColor} stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#c5a059" stopOpacity="0.15" />
                </linearGradient>
              </defs>

              {/* Halo */}
              <circle cx="150" cy="115" r="120" fill={`url(#halo_${character.id})`} />
              <circle
                cx="150"
                cy="110"
                r="74"
                fill="none"
                stroke={character.themeColor}
                strokeOpacity="0.22"
                strokeWidth="1"
                strokeDasharray="4 4"
              />

              {/* Sect Emblem Behind Silhouette */}
              {character.emblemType === 'sword' && (
                <g opacity="0.28" stroke={character.themeColor} strokeWidth="2" fill="none">
                  <line x1="150" y1="22" x2="150" y2="215" />
                  <path d="M136 168 L164 168 M144 176 L156 176" />
                  <polygon points="150,14 145,30 155,30" fill={character.themeColor} />
                </g>
              )}
              {character.emblemType === 'moon' && (
                <g opacity="0.3">
                  <path
                    d="M175 46 A54 54 0 1 0 198 140 A44 44 0 1 1 175 46 Z"
                    fill={character.themeColor}
                  />
                </g>
              )}
              {character.emblemType === 'cauldron' && (
                <g opacity="0.28" stroke={character.themeColor} strokeWidth="1.8" fill="none">
                  <circle cx="150" cy="108" r="48" />
                  <path d="M122 108 Q150 76 178 108 Q150 140 122 108 Z" />
                </g>
              )}

              {/* Flowing Xianxia Silk Ribbons */}
              <path
                d="M78 245 Q45 180 88 140 Q105 185 110 260"
                fill="none"
                stroke={`url(#silk_${character.id})`}
                strokeWidth="3"
              />
              <path
                d="M222 245 Q255 175 212 136 Q195 182 190 260"
                fill="none"
                stroke={`url(#silk_${character.id})`}
                strokeWidth="3"
              />

              {/* Ink-wash Female Cultivator Silhouette */}
              {/* Hairpin & Crown */}
              <path
                d="M128 74 L172 64"
                stroke="#c5a059"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="174" cy="63" r="3" fill={character.themeColor} />
              {/* Hair & Head */}
              <path
                d="M128 112 C122 86, 134 64, 150 64 C166 64, 178 86, 172 112 C176 140, 184 166, 178 190 L122 190 C116 166, 124 140, 128 112 Z"
                fill="#0f1218"
                stroke={character.themeColor}
                strokeOpacity="0.35"
                strokeWidth="1"
              />
              <ellipse cx="150" cy="104" rx="18" ry="22" fill="#1b1f29" />
              {/* Robe / Shoulders */}
              <path
                d="M135 128 L165 128 L218 278 L82 278 Z"
                fill={`url(#robe_${character.id})`}
                stroke="#c5a059"
                strokeOpacity="0.35"
                strokeWidth="1.2"
              />
              {/* Collar V-shape */}
              <path
                d="M134 130 L150 170 L166 130"
                fill="none"
                stroke={character.themeColor}
                strokeWidth="2"
                strokeOpacity="0.75"
              />
              {/* Waist Sash */}
              <path
                d="M122 214 Q150 222 178 214 L182 226 Q150 234 118 226 Z"
                fill={character.themeColor}
                fillOpacity="0.28"
                stroke="#c5a059"
                strokeOpacity="0.5"
                strokeWidth="0.8"
              />

              {/* Emotion Cue Overlay */}
              {runtime.emotion === 'shy' && (
                <g opacity="0.65">
                  <ellipse cx="140" cy="108" rx="4" ry="2" fill="#f472b6" />
                  <ellipse cx="160" cy="108" rx="4" ry="2" fill="#f472b6" />
                </g>
              )}
              {runtime.emotion === 'angry' && (
                <g stroke="#ef4444" strokeWidth="1.8" opacity="0.8">
                  <line x1="140" y1="96" x2="147" y2="99" />
                  <line x1="160" y1="96" x2="153" y2="99" />
                </g>
              )}
              {runtime.emotion === 'blackened' && (
                <g opacity="0.85">
                  <circle cx="143" cy="100" r="2.2" fill="#c084fc" />
                  <circle cx="157" cy="100" r="2.2" fill="#c084fc" />
                </g>
              )}

              {/* Subtle Ink Seal */}
              <rect
                x="244"
                y="266"
                width="32"
                height="48"
                rx="3"
                fill="none"
                stroke="#b91c1c"
                strokeOpacity="0.65"
                strokeWidth="1.2"
              />
              <text
                x="260"
                y="286"
                textAnchor="middle"
                fill="#dc2626"
                fillOpacity="0.75"
                fontSize="11"
                fontWeight="bold"
              >
                {character.name.slice(0, 1)}
              </text>
              <text
                x="260"
                y="302"
                textAnchor="middle"
                fill="#dc2626"
                fillOpacity="0.75"
                fontSize="11"
                fontWeight="bold"
              >
                印
              </text>
            </svg>


          </div>
        )}

      </div>

      {/* Dialogue Box & Affection */}
      <div className="space-y-2.5 z-10">
        <div className="xuan-panel rounded-lg p-3 min-h-[72px] flex items-center">
          <p className="text-xs sm:text-sm leading-relaxed text-stone-200 italic">
            {runtime.lastSpokenLine}
          </p>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5 text-pink-400 fill-pink-400/30" />
            <span className="text-stone-400">交情 · </span>
            <span className="font-semibold" style={{ color: affStage.color }}>
              {relationshipLabel}
            </span>
          </div>
          {runtime.isSoulmate && (
            <span className="inline-flex items-center gap-1 text-[11px] text-[#e2c488] bg-[#c5a059]/15 px-2 py-0.5 rounded border border-[#c5a059]/40">
              <Sparkles className="w-3 h-3" /> 道侣共鸣中
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
