// DEV ONLY — art direction study, remove after direction is chosen
import React, { useState } from 'react';

// ════════════════════════════════════════════════════════════════════
// STYLE A — PREMIUM EDITORIAL VECTOR
// Mature human proportions · sculpted hair masses · 2–3 tone shading
// Minimal outlines · refined mobility/startup branding feel
// ════════════════════════════════════════════════════════════════════

// A1: Short dark hair · light olive · male · structured navy jacket
function A1() {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',height:'100%',display:'block'}}>
      <defs>
        <radialGradient id="a1f" cx="42%" cy="34%" r="62%">
          <stop offset="0%" stopColor="#DBBE90"/><stop offset="55%" stopColor="#C8A070"/><stop offset="100%" stopColor="#A87848"/>
        </radialGradient>
        <linearGradient id="a1h" x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#201828"/><stop offset="100%" stopColor="#0E0C14"/>
        </linearGradient>
        <linearGradient id="a1j" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#182238"/><stop offset="100%" stopColor="#0C1628"/>
        </linearGradient>
        <clipPath id="a1c"><circle cx="100" cy="100" r="100"/></clipPath>
      </defs>
      <circle cx="100" cy="100" r="100" fill="#0D1B2A"/>
      <g clipPath="url(#a1c)">
        {/* Jacket */}
        <path d="M 10,205 L 36,150 Q 60,138 82,134 L 86,127 L 100,146 L 114,127 L 118,134 Q 140,138 164,150 L 190,205 Z" fill="url(#a1j)"/>
        {/* Lapels */}
        <path d="M 86,127 L 70,140 L 82,162 L 100,146 Z" fill="#1C2A40"/>
        <path d="M 114,127 L 130,140 L 118,162 L 100,146 Z" fill="#1C2A40"/>
        {/* White collar */}
        <path d="M 86,127 L 100,146 L 114,127 L 108,129 Q 100,138 92,129 Z" fill="#E8EDF4"/>
        {/* Neck */}
        <path d="M 89,122 L 89,136 Q 95,141 100,142 Q 105,141 111,136 L 111,122 L 107,126 Q 100,130 93,126 Z" fill="#C09868"/>
        {/* Face — elongated, narrows at jaw */}
        <path d="M 72,82 Q 72,52 100,48 Q 128,52 128,82 Q 130,107 122,121 Q 113,131 100,133 Q 87,131 78,121 Q 70,107 72,82 Z" fill="url(#a1f)"/>
        {/* Ears */}
        <ellipse cx="71" cy="91" rx="4.5" ry="6" fill="#BA9060"/>
        <ellipse cx="129" cy="91" rx="4.5" ry="6" fill="#BA9060"/>
        <path d="M 71,87 Q 73,91 71,95" stroke="#A07848" strokeWidth="0.8" fill="none"/>
        <path d="M 129,87 Q 127,91 129,95" stroke="#A07848" strokeWidth="0.8" fill="none"/>
        {/* Cheekbone highlights */}
        <ellipse cx="82" cy="98" rx="8" ry="5" fill="#DCC090" opacity="0.18" transform="rotate(-15 82 98)"/>
        <ellipse cx="118" cy="98" rx="8" ry="5" fill="#DCC090" opacity="0.18" transform="rotate(15 118 98)"/>
        {/* Jaw shadow */}
        <path d="M 80,119 Q 100,129 120,119 Q 113,131 100,133 Q 87,131 80,119 Z" fill="#A07848" opacity="0.14"/>
        {/* Hair — close-cropped, sculptural */}
        <path d="M 72,82 Q 72,54 100,48 Q 128,54 128,82 Q 123,68 118,58 Q 110,48 100,46 Q 90,48 82,58 Q 77,68 72,82 Z" fill="url(#a1h)"/>
        <path d="M 72,82 Q 74,64 82,56 Q 76,64 74,76 Z" fill="#100A1A" opacity="0.6"/>
        <path d="M 73,82 Q 75,88 74,96 Q 72,89 72,82 Z" fill="#1A1422"/>
        <path d="M 127,82 Q 125,88 126,96 Q 128,89 128,82 Z" fill="#1A1422"/>
        {/* Brows — tapered arcs */}
        <path d="M 80,76 Q 87,71 94,73" stroke="#1C1218" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
        <path d="M 106,73 Q 113,71 120,76" stroke="#1C1218" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
        {/* Left eye — almond, adult scale */}
        <path d="M 80,83 Q 87,77 94,83 Q 87,88.5 80,83 Z" fill="#0C0A0E"/>
        <circle cx="87" cy="83" r="3.4" fill="#3A2010"/>
        <circle cx="87" cy="83" r="2" fill="#060402"/>
        <circle cx="88.3" cy="81.4" r="1" fill="white" opacity="0.82"/>
        <path d="M 80,83 Q 87,77.5 94,83" stroke="#0C0A0E" strokeWidth="1.4" fill="none"/>
        {/* Right eye */}
        <path d="M 106,83 Q 113,77 120,83 Q 113,88.5 106,83 Z" fill="#0C0A0E"/>
        <circle cx="113" cy="83" r="3.4" fill="#3A2010"/>
        <circle cx="113" cy="83" r="2" fill="#060402"/>
        <circle cx="114.3" cy="81.4" r="1" fill="white" opacity="0.82"/>
        <path d="M 106,83 Q 113,77.5 120,83" stroke="#0C0A0E" strokeWidth="1.4" fill="none"/>
        {/* Nose — shadow only, no lines */}
        <ellipse cx="95.5" cy="104" rx="3.8" ry="2.2" fill="#7A4828" opacity="0.28"/>
        <ellipse cx="104.5" cy="104" rx="3.8" ry="2.2" fill="#7A4828" opacity="0.28"/>
        <ellipse cx="100" cy="101" rx="3" ry="2" fill="#DEC090" opacity="0.18"/>
        {/* Mouth — restrained, calm */}
        <path d="M 90,111 Q 95,108 100,109.5 Q 105,108 110,111" stroke="#7A4028" strokeWidth="1.4" fill="none"/>
        <path d="M 91,111 Q 100,117.5 109,111" fill="#C09060" opacity="0.28"/>
        <ellipse cx="100" cy="114" rx="5" ry="2" fill="#D4A878" opacity="0.16"/>
      </g>
    </svg>
  );
}

// A2: Natural/afro · medium-dark skin · female · antique gold glasses
function A2() {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',height:'100%',display:'block'}}>
      <defs>
        <radialGradient id="a2f" cx="40%" cy="35%" r="62%">
          <stop offset="0%" stopColor="#C88A52"/><stop offset="60%" stopColor="#A86E38"/><stop offset="100%" stopColor="#884E20"/>
        </radialGradient>
        <radialGradient id="a2h" cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor="#1C0E08"/><stop offset="100%" stopColor="#060404"/>
        </radialGradient>
        <clipPath id="a2c"><circle cx="100" cy="100" r="100"/></clipPath>
      </defs>
      <circle cx="100" cy="100" r="100" fill="#1A0C18"/>
      <g clipPath="url(#a2c)">
        <path d="M 10,205 L 42,152 Q 66,140 86,137 L 90,131 Q 96,139 100,141 Q 104,139 110,131 L 114,137 Q 134,140 158,152 L 190,205 Z" fill="#1E1520"/>
        <path d="M 90,131 Q 100,141 110,131 Q 106,136 100,138 Q 94,136 90,131 Z" fill="#251A28"/>
        {/* Neck */}
        <path d="M 89,123 L 89,136 Q 95,141 100,142 Q 105,141 111,136 L 111,123 L 107,127 Q 100,131 93,127 Z" fill="#A26C38"/>
        {/* Face */}
        <path d="M 74,84 Q 74,52 100,49 Q 126,52 126,84 Q 128,108 120,122 Q 112,132 100,134 Q 88,132 80,122 Q 72,108 74,84 Z" fill="url(#a2f)"/>
        <ellipse cx="73" cy="92" rx="4" ry="5.5" fill="#986030"/>
        <ellipse cx="127" cy="92" rx="4" ry="5.5" fill="#986030"/>
        <ellipse cx="84" cy="99" rx="7" ry="5" fill="#C88A50" opacity="0.2" transform="rotate(-15 84 99)"/>
        <ellipse cx="116" cy="99" rx="7" ry="5" fill="#C88A50" opacity="0.2" transform="rotate(15 116 99)"/>
        {/* Natural hair — organic puff, not helmet */}
        <ellipse cx="100" cy="56" rx="40" ry="36" fill="url(#a2h)"/>
        <ellipse cx="69" cy="70" rx="13" ry="17" fill="#0A0604"/>
        <ellipse cx="131" cy="70" rx="13" ry="17" fill="#0A0604"/>
        {/* Organic silhouette bumps */}
        <ellipse cx="86" cy="32" rx="11" ry="9" fill="#080402"/>
        <ellipse cx="114" cy="34" rx="9" ry="8" fill="#0A0604"/>
        <ellipse cx="72" cy="55" rx="8" ry="10" fill="#080402"/>
        <ellipse cx="128" cy="57" rx="8" ry="10" fill="#080402"/>
        <ellipse cx="100" cy="28" rx="7" ry="6" fill="#060402"/>
        {/* Hair highlight — subtle sheen */}
        <ellipse cx="98" cy="44" rx="12" ry="5" fill="#261C10" opacity="0.55"/>
        <ellipse cx="100" cy="62" rx="34" ry="10" fill="#040202" opacity="0.5"/>
        {/* Hair meets forehead */}
        <path d="M 80,82 Q 88,72 100,70 Q 112,72 120,82" fill="#0A0604"/>
        {/* Brows */}
        <path d="M 81,77 Q 88,72 95,74" stroke="#1A0C08" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <path d="M 105,74 Q 112,72 119,77" stroke="#1A0C08" strokeWidth="2" fill="none" strokeLinecap="round"/>
        {/* Eyes */}
        <path d="M 80,84 Q 87,78.5 94,84 Q 87,89 80,84 Z" fill="#0C0806"/>
        <circle cx="87" cy="84" r="3.2" fill="#2C1808"/>
        <circle cx="87" cy="84" r="1.8" fill="#040202"/>
        <circle cx="88.3" cy="82.5" r="0.9" fill="white" opacity="0.8"/>
        <path d="M 80,84 Q 87,79 94,84" stroke="#0A0806" strokeWidth="1.3" fill="none"/>
        <path d="M 106,84 Q 113,78.5 120,84 Q 113,89 106,84 Z" fill="#0C0806"/>
        <circle cx="113" cy="84" r="3.2" fill="#2C1808"/>
        <circle cx="113" cy="84" r="1.8" fill="#040202"/>
        <circle cx="114.3" cy="82.5" r="0.9" fill="white" opacity="0.8"/>
        <path d="M 106,84 Q 113,79 120,84" stroke="#0A0806" strokeWidth="1.3" fill="none"/>
        {/* Round glasses — antique gold */}
        <circle cx="87" cy="84" r="9.5" fill="none" stroke="#8B6914" strokeWidth="1.8"/>
        <circle cx="113" cy="84" r="9.5" fill="none" stroke="#8B6914" strokeWidth="1.8"/>
        <line x1="96.5" y1="84" x2="103.5" y2="84" stroke="#8B6914" strokeWidth="1.5"/>
        <line x1="77.5" y1="84" x2="68" y2="80" stroke="#8B6914" strokeWidth="1.5"/>
        <line x1="122.5" y1="84" x2="132" y2="80" stroke="#8B6914" strokeWidth="1.5"/>
        {/* Nose */}
        <ellipse cx="95.5" cy="104" rx="3.5" ry="2" fill="#7A4820" opacity="0.28"/>
        <ellipse cx="104.5" cy="104" rx="3.5" ry="2" fill="#7A4820" opacity="0.28"/>
        {/* Mouth */}
        <path d="M 91,112 Q 96,109 100,110.5 Q 104,109 109,112" stroke="#6A3820" strokeWidth="1.3" fill="none"/>
        <path d="M 92,112 Q 100,118 108,112" fill="#A06030" opacity="0.28"/>
      </g>
    </svg>
  );
}

// A3: Long braids · deep dark skin · female · elegant structured top
function A3() {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',height:'100%',display:'block'}}>
      <defs>
        <radialGradient id="a3f" cx="42%" cy="34%" r="60%">
          <stop offset="0%" stopColor="#6A3A20"/><stop offset="55%" stopColor="#4E2610"/><stop offset="100%" stopColor="#361408"/>
        </radialGradient>
        <linearGradient id="a3h" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#0C0806"/><stop offset="100%" stopColor="#040204"/>
        </linearGradient>
        <linearGradient id="a3t" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1A1E26"/><stop offset="100%" stopColor="#0E1218"/>
        </linearGradient>
        <clipPath id="a3c"><circle cx="100" cy="100" r="100"/></clipPath>
      </defs>
      <circle cx="100" cy="100" r="100" fill="#080F14"/>
      <g clipPath="url(#a3c)">
        {/* Elegant top — deep slate with subtle sheen */}
        <path d="M 10,205 L 38,152 Q 62,140 82,136 L 86,128 L 100,143 L 114,128 L 118,136 Q 138,140 162,152 L 190,205 Z" fill="url(#a3t)"/>
        {/* Neckline — wide scoop */}
        <path d="M 86,128 Q 100,143 114,128 Q 108,136 100,138 Q 92,136 86,128 Z" fill="#222830"/>
        {/* Braids behind shoulders — extending down */}
        <path d="M 68,78 Q 62,105 56,145 Q 54,160 58,165 Q 62,165 66,158 Q 70,140 74,112 Q 76,95 76,82 Z" fill="url(#a3h)"/>
        <path d="M 62,100 Q 58,120 56,145" stroke="#1A1208" strokeWidth="1.5" fill="none" opacity="0.5"/>
        <path d="M 66,100 Q 62,120 60,148" stroke="#261A0A" strokeWidth="1" fill="none" opacity="0.4"/>
        <path d="M 132,78 Q 138,105 144,145 Q 146,160 142,165 Q 138,165 134,158 Q 130,140 126,112 Q 124,95 124,82 Z" fill="url(#a3h)"/>
        <path d="M 138,100 Q 142,120 144,145" stroke="#1A1208" strokeWidth="1.5" fill="none" opacity="0.5"/>
        <path d="M 134,100 Q 138,120 140,148" stroke="#261A0A" strokeWidth="1" fill="none" opacity="0.4"/>
        {/* Neck */}
        <path d="M 89,124 L 89,137 Q 95,141 100,142 Q 105,141 111,137 L 111,124 L 107,128 Q 100,132 93,128 Z" fill="#4A2410"/>
        {/* Face */}
        <path d="M 74,84 Q 74,53 100,49 Q 126,53 126,84 Q 128,108 119,122 Q 111,133 100,134 Q 89,133 81,122 Q 72,108 74,84 Z" fill="url(#a3f)"/>
        <ellipse cx="73" cy="92" rx="4" ry="5.5" fill="#3A1A08"/>
        <ellipse cx="127" cy="92" rx="4" ry="5.5" fill="#3A1A08"/>
        {/* Forehead highlight */}
        <ellipse cx="100" cy="65" rx="14" ry="8" fill="#7A4A28" opacity="0.22"/>
        {/* Cheekbone */}
        <ellipse cx="82" cy="100" rx="8" ry="5" fill="#6A3A1A" opacity="0.2" transform="rotate(-10 82 100)"/>
        <ellipse cx="118" cy="100" rx="8" ry="5" fill="#6A3A1A" opacity="0.2" transform="rotate(10 118 100)"/>
        {/* Braids — front parted, flowing from crown */}
        {/* Left braid group */}
        <path d="M 76,80 Q 72,86 66,95 Q 64,100 66,104" stroke="#0E0A06" strokeWidth="5" fill="none" strokeLinecap="round"/>
        <path d="M 76,80 Q 72,86 66,95 Q 64,100 66,104" stroke="#1C1408" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5"/>
        <path d="M 80,79 Q 76,88 72,100 Q 70,108 72,114" stroke="#0E0A06" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
        <path d="M 80,79 Q 76,88 72,100 Q 70,108 72,114" stroke="#201808" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.6"/>
        {/* Right braid group */}
        <path d="M 124,80 Q 128,86 134,95 Q 136,100 134,104" stroke="#0E0A06" strokeWidth="5" fill="none" strokeLinecap="round"/>
        <path d="M 124,80 Q 128,86 134,95 Q 136,100 134,104" stroke="#1C1408" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5"/>
        <path d="M 120,79 Q 124,88 128,100 Q 130,108 128,114" stroke="#0E0A06" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
        {/* Hair top — parted center */}
        <path d="M 74,84 Q 74,54 100,48 Q 126,54 126,84 Q 120,66 112,54 Q 106,47 100,46 Q 94,47 88,54 Q 80,66 74,84 Z" fill="#0A0806"/>
        {/* Center part */}
        <line x1="100" y1="46" x2="100" y2="70" stroke="#1A1208" strokeWidth="1.5" opacity="0.5"/>
        {/* Brows */}
        <path d="M 81,77 Q 88,72 95,74" stroke="#0A0604" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
        <path d="M 105,74 Q 112,72 119,77" stroke="#0A0604" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
        {/* Eyes */}
        <path d="M 80,84 Q 87,78.5 94,84 Q 87,89 80,84 Z" fill="#0A0806"/>
        <circle cx="87" cy="84" r="3.2" fill="#1C0C04"/>
        <circle cx="87" cy="84" r="1.8" fill="#040202"/>
        <circle cx="88.4" cy="82.5" r="0.9" fill="white" opacity="0.82"/>
        <path d="M 80,84 Q 87,79 94,84" stroke="#080604" strokeWidth="1.4" fill="none"/>
        <path d="M 106,84 Q 113,78.5 120,84 Q 113,89 106,84 Z" fill="#0A0806"/>
        <circle cx="113" cy="84" r="3.2" fill="#1C0C04"/>
        <circle cx="113" cy="84" r="1.8" fill="#040202"/>
        <circle cx="114.4" cy="82.5" r="0.9" fill="white" opacity="0.82"/>
        <path d="M 106,84 Q 113,79 120,84" stroke="#080604" strokeWidth="1.4" fill="none"/>
        {/* Nose */}
        <ellipse cx="95.5" cy="104" rx="3.5" ry="2" fill="#2A1008" opacity="0.35"/>
        <ellipse cx="104.5" cy="104" rx="3.5" ry="2" fill="#2A1008" opacity="0.35"/>
        {/* Mouth */}
        <path d="M 91,111 Q 96,108 100,109.5 Q 104,108 109,111" stroke="#3A1808" strokeWidth="1.4" fill="none"/>
        <path d="M 92,111 Q 100,117 108,111" fill="#6A3818" opacity="0.3"/>
      </g>
    </svg>
  );
}

// A4: Hijab (deep indigo) · warm medium skin · female · refined top
function A4() {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',height:'100%',display:'block'}}>
      <defs>
        <radialGradient id="a4f" cx="42%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#D4A870"/><stop offset="55%" stopColor="#BC9058"/><stop offset="100%" stopColor="#9C7038"/>
        </radialGradient>
        <linearGradient id="a4h" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#2A3858"/><stop offset="100%" stopColor="#1A2440"/>
        </linearGradient>
        <linearGradient id="a4t" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8E4DC"/><stop offset="100%" stopColor="#D0CCC4"/>
        </linearGradient>
        <clipPath id="a4c"><circle cx="100" cy="100" r="100"/></clipPath>
      </defs>
      <circle cx="100" cy="100" r="100" fill="#1A1510"/>
      <g clipPath="url(#a4c)">
        {/* Cream/ivory refined top */}
        <path d="M 10,205 L 40,155 Q 65,142 86,139 L 90,133 L 100,148 L 110,133 L 114,139 Q 135,142 160,155 L 190,205 Z" fill="url(#a4t)"/>
        <path d="M 90,133 Q 100,148 110,133 Q 106,140 100,142 Q 94,140 90,133 Z" fill="#E0DCD4"/>
        {/* Hijab — wraps under chin, drapes over shoulders */}
        {/* Back/shoulder drape */}
        <path d="M 38,155 Q 55,130 68,115 Q 62,118 58,125 Q 48,138 38,155 Z" fill="#253358"/>
        <path d="M 162,155 Q 145,130 132,115 Q 138,118 142,125 Q 152,138 162,155 Z" fill="#253358"/>
        {/* Main hijab wrap — covers hair, frames face */}
        <path d="M 66,90 Q 64,72 70,60 Q 78,46 100,44 Q 122,46 130,60 Q 136,72 134,90 Q 130,106 124,120 Q 118,134 114,139 L 86,139 Q 82,134 76,120 Q 70,106 66,90 Z" fill="url(#a4h)"/>
        {/* Hijab fold/highlight */}
        <path d="M 80,50 Q 90,46 100,44 Q 110,46 120,50 Q 112,46 100,44 Q 88,46 80,50 Z" fill="#3A4E78" opacity="0.5"/>
        <path d="M 68,88 Q 70,70 80,58" stroke="#3A4E78" strokeWidth="1.5" fill="none" opacity="0.4"/>
        {/* Under-chin fabric edge */}
        <path d="M 78,124 Q 86,134 100,136 Q 114,134 122,124 Q 116,132 100,134 Q 84,132 78,124 Z" fill="#1E2C4A"/>
        {/* Face oval — framed by hijab */}
        <path d="M 76,86 Q 76,56 100,52 Q 124,56 124,86 Q 126,108 118,120 Q 110,130 100,132 Q 90,130 82,120 Q 74,108 76,86 Z" fill="url(#a4f)"/>
        {/* Cheekbone highlights */}
        <ellipse cx="84" cy="100" rx="8" ry="5" fill="#D4AA70" opacity="0.2" transform="rotate(-12 84 100)"/>
        <ellipse cx="116" cy="100" rx="8" ry="5" fill="#D4AA70" opacity="0.2" transform="rotate(12 116 100)"/>
        {/* Brows */}
        <path d="M 83,79 Q 90,74 97,76" stroke="#3A2010" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <path d="M 103,76 Q 110,74 117,79" stroke="#3A2010" strokeWidth="2" fill="none" strokeLinecap="round"/>
        {/* Eyes — slightly warmer iris */}
        <path d="M 82,86 Q 89,80.5 96,86 Q 89,91 82,86 Z" fill="#0C0806"/>
        <circle cx="89" cy="86" r="3.4" fill="#4A2C10"/>
        <circle cx="89" cy="86" r="2" fill="#060402"/>
        <circle cx="90.3" cy="84.4" r="1" fill="white" opacity="0.82"/>
        <path d="M 82,86 Q 89,81 96,86" stroke="#0C0806" strokeWidth="1.4" fill="none"/>
        <path d="M 104,86 Q 111,80.5 118,86 Q 111,91 104,86 Z" fill="#0C0806"/>
        <circle cx="111" cy="86" r="3.4" fill="#4A2C10"/>
        <circle cx="111" cy="86" r="2" fill="#060402"/>
        <circle cx="112.3" cy="84.4" r="1" fill="white" opacity="0.82"/>
        <path d="M 104,86 Q 111,81 118,86" stroke="#0C0806" strokeWidth="1.4" fill="none"/>
        {/* Nose */}
        <ellipse cx="95.5" cy="106" rx="3.8" ry="2.2" fill="#8A5830" opacity="0.27"/>
        <ellipse cx="104.5" cy="106" rx="3.8" ry="2.2" fill="#8A5830" opacity="0.27"/>
        {/* Mouth — warm, calm */}
        <path d="M 90,113 Q 95,110 100,111.5 Q 105,110 110,113" stroke="#7A4828" strokeWidth="1.4" fill="none"/>
        <path d="M 91,113 Q 100,119 109,113" fill="#C09060" opacity="0.28"/>
        <ellipse cx="100" cy="115.5" rx="5" ry="2" fill="#D4A870" opacity="0.16"/>
        {/* Small gold earring peeking out */}
        <circle cx="76" cy="108" r="2.5" fill="#B8960C" opacity="0.7"/>
        <circle cx="76" cy="108" r="1.5" fill="#D4AC14" opacity="0.7"/>
      </g>
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════════
// STYLE B — SCULPTED MINIMAL VECTOR
// Geometric construction · sharp silhouettes · controlled detail
// Sophisticated at small sizes · no emoji or cartoon feeling
// ════════════════════════════════════════════════════════════════════

// B1: Short geometric hair · medium warm skin · male · slate turtleneck
function B1() {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',height:'100%',display:'block'}}>
      <defs>
        <linearGradient id="b1f" x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#C8986A"/><stop offset="100%" stopColor="#A07848"/>
        </linearGradient>
        <linearGradient id="b1h" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#1E1C24"/><stop offset="100%" stopColor="#0E0C14"/>
        </linearGradient>
        <clipPath id="b1c"><circle cx="100" cy="100" r="100"/></clipPath>
      </defs>
      <circle cx="100" cy="100" r="100" fill="#141C24"/>
      <g clipPath="url(#b1c)">
        {/* Turtleneck — clean geometric shape */}
        <rect x="0" y="148" width="200" height="60" fill="#1C2430"/>
        <path d="M 0,148 L 30,148 L 48,140 Q 68,134 84,132 L 84,128 Q 94,140 100,140 Q 106,140 116,128 L 116,132 Q 132,134 152,140 L 170,148 L 200,148 L 200,160 L 0,160 Z" fill="#1C2430"/>
        {/* Turtleneck roll */}
        <path d="M 84,128 L 84,140 Q 92,148 100,148 Q 108,148 116,140 L 116,128 Q 108,138 100,138 Q 92,138 84,128 Z" fill="#242E3C"/>
        <path d="M 84,140 Q 92,148 100,148 Q 108,148 116,140" stroke="#2C3A4A" strokeWidth="1.5" fill="none"/>
        {/* Face — more angular path */}
        <path d="M 74,82 L 74,56 Q 86,44 100,42 Q 114,44 126,56 L 126,82 Q 128,104 122,118 L 112,130 Q 106,134 100,134 Q 94,134 88,130 L 78,118 Q 72,104 74,82 Z" fill="url(#b1f)"/>
        {/* Geometric ear shapes */}
        <path d="M 74,86 L 68,88 L 68,98 L 74,100" fill="#B08858" stroke="none"/>
        <path d="M 126,86 L 132,88 L 132,98 L 126,100" fill="#B08858" stroke="none"/>
        {/* Geometric hair — clean angular mass */}
        <path d="M 74,82 L 74,56 Q 86,44 100,42 Q 114,44 126,56 L 126,82 L 120,68 L 116,52 Q 106,42 100,40 Q 94,42 84,52 L 80,68 Z" fill="url(#b1h)"/>
        {/* Hair edge — sharp geometric temple */}
        <path d="M 74,82 L 76,70 L 80,60" stroke="#0E0C14" strokeWidth="1.5" fill="none"/>
        <path d="M 126,82 L 124,70 L 120,60" stroke="#0E0C14" strokeWidth="1.5" fill="none"/>
        {/* Geometric brows — precise, angular */}
        <path d="M 80,76 L 88,70 L 95,72" stroke="#1A1618" strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
        <path d="M 120,76 L 112,70 L 105,72" stroke="#1A1618" strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
        {/* Eyes — geometric almond */}
        <path d="M 79,84 L 87,78 L 95,84 L 87,89 Z" fill="#0E0C10"/>
        <circle cx="87" cy="84" r="3.4" fill="#2A1C0C"/>
        <circle cx="87" cy="84" r="2" fill="#060404"/>
        <circle cx="88.5" cy="82.5" r="1" fill="white" opacity="0.85"/>
        <path d="M 79,84 L 87,78 L 95,84" stroke="#0A080C" strokeWidth="1.5" fill="none"/>
        <path d="M 105,84 L 113,78 L 121,84 L 113,89 Z" fill="#0E0C10"/>
        <circle cx="113" cy="84" r="3.4" fill="#2A1C0C"/>
        <circle cx="113" cy="84" r="2" fill="#060404"/>
        <circle cx="114.5" cy="82.5" r="1" fill="white" opacity="0.85"/>
        <path d="M 105,84 L 113,78 L 121,84" stroke="#0A080C" strokeWidth="1.5" fill="none"/>
        {/* Geometric nose — minimal angular shadow */}
        <path d="M 98,98 L 96,106 L 100,107 L 104,106 L 102,98 Z" fill="#8A6030" opacity="0.2"/>
        {/* Mouth — clean horizontal with defined corners */}
        <path d="M 90,112 L 100,112 L 110,112" stroke="#6A4020" strokeWidth="1.6" fill="none" strokeLinecap="square"/>
        <path d="M 90,112 Q 100,118 110,112" fill="#B07848" opacity="0.22"/>
        {/* Sharp jaw shadow */}
        <path d="M 78,118 L 88,130 Q 100,134 112,130 L 122,118 Q 114,128 100,130 Q 86,128 78,118 Z" fill="#8A6030" opacity="0.12"/>
      </g>
    </svg>
  );
}

// B2: Coily puff · light/porcelain skin · female · black structured top
function B2() {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',height:'100%',display:'block'}}>
      <defs>
        <linearGradient id="b2f" x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#F0E6D8"/><stop offset="100%" stopColor="#D8C8B4"/>
        </linearGradient>
        <radialGradient id="b2h" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#1C1410"/><stop offset="100%" stopColor="#060402"/>
        </radialGradient>
        <clipPath id="b2c"><circle cx="100" cy="100" r="100"/></clipPath>
      </defs>
      <circle cx="100" cy="100" r="100" fill="#0F0F18"/>
      <g clipPath="url(#b2c)">
        <path d="M 0,205 L 0,148 L 40,148 L 58,138 Q 76,132 86,130 L 90,125 L 100,138 L 110,125 L 114,130 Q 124,132 142,138 L 160,148 L 200,148 L 200,205 Z" fill="#101018"/>
        <path d="M 90,125 Q 100,138 110,125 Q 106,133 100,135 Q 94,133 90,125 Z" fill="#181820"/>
        {/* Neck */}
        <path d="M 90,122 L 90,134 Q 95,139 100,140 Q 105,139 110,134 L 110,122 L 106,126 Q 100,130 94,126 Z" fill="#D8C8B0"/>
        {/* Face — clean geometric */}
        <path d="M 74,82 L 74,56 Q 86,46 100,44 Q 114,46 126,56 L 126,82 Q 126,106 119,120 L 110,130 Q 104,134 100,134 Q 96,134 90,130 L 81,120 Q 74,106 74,82 Z" fill="url(#b2f)"/>
        {/* Geometric ears */}
        <path d="M 74,84 L 68,86 L 68,98 L 74,100" fill="#D0C0AA"/>
        <path d="M 126,84 L 132,86 L 132,98 L 126,100" fill="#D0C0AA"/>
        {/* Coily hair — geometric puff with angular silhouette */}
        {/* Core puff */}
        <ellipse cx="100" cy="52" rx="38" ry="32" fill="url(#b2h)"/>
        {/* Angular bumps for coily texture */}
        <path d="M 62,60 L 66,48 L 74,44 L 70,56 Z" fill="#0A0806"/>
        <path d="M 76,36 L 84,30 L 90,34 L 84,40 Z" fill="#080604"/>
        <path d="M 96,28 L 104,26 L 108,32 L 100,34 Z" fill="#0A0806"/>
        <path d="M 114,32 L 120,28 L 126,36 L 120,40 Z" fill="#080604"/>
        <path d="M 130,46 L 136,40 L 140,50 L 134,54 Z" fill="#0A0806"/>
        <path d="M 138,62 L 142,56 L 144,66 L 140,70 Z" fill="#060402"/>
        <path d="M 60,70 L 62,62 L 66,72 L 62,76 Z" fill="#060402"/>
        {/* Puff meets forehead */}
        <path d="M 78,82 Q 84,72 100,70 Q 116,72 122,82" fill="#0C0A08"/>
        {/* Geometric brows — clean */}
        <path d="M 80,77 L 88,72 L 95,73" stroke="#C0A080" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
        <path d="M 105,73 L 112,72 L 120,77" stroke="#C0A080" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
        {/* Eyes */}
        <path d="M 79,84 L 87,78 L 95,84 L 87,89.5 Z" fill="#0C0A10"/>
        <circle cx="87" cy="84" r="3.4" fill="#2C1E30"/>
        <circle cx="87" cy="84" r="2" fill="#060408"/>
        <circle cx="88.5" cy="82.5" r="1" fill="white" opacity="0.88"/>
        <path d="M 79,84 L 87,78.5 L 95,84" stroke="#0C0A10" strokeWidth="1.5" fill="none"/>
        <path d="M 105,84 L 113,78 L 121,84 L 113,89.5 Z" fill="#0C0A10"/>
        <circle cx="113" cy="84" r="3.4" fill="#2C1E30"/>
        <circle cx="113" cy="84" r="2" fill="#060408"/>
        <circle cx="114.5" cy="82.5" r="1" fill="white" opacity="0.88"/>
        <path d="M 105,84 L 113,78.5 L 121,84" stroke="#0C0A10" strokeWidth="1.5" fill="none"/>
        {/* Nose — geometric minimal */}
        <path d="M 97,98 L 95,106 L 100,108 L 105,106 L 103,98 Z" fill="#C0A080" opacity="0.2"/>
        {/* Mouth */}
        <path d="M 90,112 L 95,109 L 100,110 L 105,109 L 110,112" stroke="#A08068" strokeWidth="1.4" fill="none" strokeLinejoin="round"/>
        <path d="M 91,112 Q 100,118 109,112" fill="#D8B898" opacity="0.22"/>
      </g>
    </svg>
  );
}

// B3: Long straight hair · deep dark skin · female · button-up
function B3() {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',height:'100%',display:'block'}}>
      <defs>
        <linearGradient id="b3f" x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#5A2C14"/><stop offset="100%" stopColor="#3A1608"/>
        </linearGradient>
        <linearGradient id="b3h" x1="0.2" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#0A0806"/><stop offset="100%" stopColor="#040202"/>
        </linearGradient>
        <clipPath id="b3c"><circle cx="100" cy="100" r="100"/></clipPath>
      </defs>
      <circle cx="100" cy="100" r="100" fill="#0C1820"/>
      <g clipPath="url(#b3c)">
        {/* Button-up shirt */}
        <path d="M 0,205 L 0,150 L 38,150 L 58,140 Q 78,133 88,131 L 92,126 L 100,143 L 108,126 L 112,131 Q 122,133 142,140 L 162,150 L 200,150 L 200,205 Z" fill="#1E2430"/>
        <path d="M 92,126 L 100,143 L 108,126 L 104,128 Q 100,138 96,128 Z" fill="#E8EDF4"/>
        <line x1="100" y1="143" x2="100" y2="200" stroke="#182030" strokeWidth="1"/>
        <circle cx="100" cy="155" r="1.5" fill="#303C4C"/>
        <circle cx="100" cy="167" r="1.5" fill="#303C4C"/>
        {/* Hair — long, geometric straight mass behind face */}
        <path d="M 72,80 Q 70,60 76,46 Q 78,38 100,36 Q 122,38 124,46 Q 130,60 128,80 L 128,150 Q 118,155 112,158 L 112,130 Q 110,140 106,148 L 106,80" fill="url(#b3h)"/>
        <path d="M 72,80 Q 72,60 78,46 Q 80,38 100,36 L 88,42 Q 80,50 76,62 Q 74,70 74,80 Z" fill="#060402"/>
        {/* Right side hair */}
        <path d="M 128,80 Q 128,60 122,46 Q 112,36 100,36 L 112,42 Q 120,50 124,62 Q 126,70 126,80 Z" fill="#060402"/>
        {/* Left long hair panel */}
        <path d="M 72,80 L 64,90 L 58,120 Q 56,140 60,158 Q 64,165 68,158 Q 70,140 72,120 L 76,90 Z" fill="url(#b3h)"/>
        {/* Right long hair panel */}
        <path d="M 128,80 L 136,90 L 142,120 Q 144,140 140,158 Q 136,165 132,158 Q 130,140 128,120 L 124,90 Z" fill="url(#b3h)"/>
        {/* Hair highlight — clean linear stripe */}
        <path d="M 90,36 L 92,52 Q 92,56 90,60 L 88,44 Z" fill="#161210" opacity="0.6"/>
        {/* Neck */}
        <path d="M 90,123 L 90,135 Q 95,140 100,141 Q 105,140 110,135 L 110,123 L 106,127 Q 100,131 94,127 Z" fill="#3A1808"/>
        {/* Face */}
        <path d="M 74,82 L 74,56 Q 86,46 100,44 Q 114,46 126,56 L 126,82 Q 126,106 119,120 L 110,130 Q 104,134 100,134 Q 96,134 90,130 L 81,120 Q 74,106 74,82 Z" fill="url(#b3f)"/>
        {/* Forehead sheen */}
        <ellipse cx="100" cy="64" rx="15" ry="9" fill="#6A3820" opacity="0.25"/>
        {/* Brows */}
        <path d="M 80,76 L 88,70 L 95,72" stroke="#0A0604" strokeWidth="2.3" fill="none" strokeLinecap="round"/>
        <path d="M 105,72 L 112,70 L 120,76" stroke="#0A0604" strokeWidth="2.3" fill="none" strokeLinecap="round"/>
        {/* Eyes */}
        <path d="M 79,84 L 87,78 L 95,84 L 87,89.5 Z" fill="#0A0806"/>
        <circle cx="87" cy="84" r="3.4" fill="#1C0C04"/>
        <circle cx="87" cy="84" r="2" fill="#040202"/>
        <circle cx="88.5" cy="82.5" r="1" fill="white" opacity="0.85"/>
        <path d="M 79,84 L 87,78.5 L 95,84" stroke="#080604" strokeWidth="1.5" fill="none"/>
        <path d="M 105,84 L 113,78 L 121,84 L 113,89.5 Z" fill="#0A0806"/>
        <circle cx="113" cy="84" r="3.4" fill="#1C0C04"/>
        <circle cx="113" cy="84" r="2" fill="#040202"/>
        <circle cx="114.5" cy="82.5" r="1" fill="white" opacity="0.85"/>
        <path d="M 105,84 L 113,78.5 L 121,84" stroke="#080604" strokeWidth="1.5" fill="none"/>
        {/* Nose */}
        <path d="M 98,100 L 96,108 L 100,109 L 104,108 L 102,100 Z" fill="#2A1008" opacity="0.28"/>
        {/* Mouth */}
        <path d="M 90,112 L 95,109 L 100,110 L 105,109 L 110,112" stroke="#3A1408" strokeWidth="1.4" fill="none" strokeLinejoin="round"/>
        <path d="M 91,112 Q 100,118 109,112" fill="#6A3018" opacity="0.28"/>
      </g>
    </svg>
  );
}

// B4: Head wrap/turban · medium-light warm skin · male · structured hoodie
function B4() {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',height:'100%',display:'block'}}>
      <defs>
        <linearGradient id="b4f" x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#D4A870"/><stop offset="100%" stopColor="#B08848"/>
        </linearGradient>
        <linearGradient id="b4w" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#6B4E2A"/><stop offset="50%" stopColor="#4E3418"/><stop offset="100%" stopColor="#3A2410"/>
        </linearGradient>
        <clipPath id="b4c"><circle cx="100" cy="100" r="100"/></clipPath>
      </defs>
      <circle cx="100" cy="100" r="100" fill="#1A1020"/>
      <g clipPath="url(#b4c)">
        {/* Hoodie */}
        <path d="M 0,205 L 0,148 L 36,148 L 54,138 Q 74,130 88,128 L 92,122 L 100,136 L 108,122 L 112,128 Q 126,130 146,138 L 164,148 L 200,148 L 200,205 Z" fill="#1E1828"/>
        <path d="M 92,122 L 100,136 L 108,122 Q 104,130 100,132 Q 96,130 92,122 Z" fill="#282030"/>
        {/* Hoodie strings */}
        <line x1="96" y1="132" x2="90" y2="158" stroke="#302838" strokeWidth="2"/>
        <line x1="104" y1="132" x2="110" y2="158" stroke="#302838" strokeWidth="2"/>
        {/* Neck */}
        <path d="M 90,120 L 90,132 Q 95,137 100,138 Q 105,137 110,132 L 110,120 L 106,124 Q 100,128 94,124 Z" fill="#C09050"/>
        {/* Face */}
        <path d="M 75,84 L 75,58 Q 86,46 100,44 Q 114,46 125,58 L 125,84 Q 125,107 118,120 L 108,130 Q 103,134 100,134 Q 97,134 92,130 L 82,120 Q 75,107 75,84 Z" fill="url(#b4f)"/>
        {/* Geometric ears */}
        <path d="M 75,86 L 70,88 L 70,98 L 75,100" fill="#C09050"/>
        <path d="M 125,86 L 130,88 L 130,98 L 125,100" fill="#C09050"/>
        {/* Turban/wrap — geometric, clean layered shapes */}
        {/* Base wrap */}
        <path d="M 66,86 Q 64,60 76,46 Q 86,36 100,34 Q 114,36 124,46 Q 136,60 134,86 Q 128,72 120,58 Q 110,44 100,42 Q 90,44 80,58 Q 72,72 66,86 Z" fill="url(#b4w)"/>
        {/* Wrap layer 1 — angular diagonal wraps */}
        <path d="M 66,86 Q 72,70 82,58 Q 90,50 100,48 Q 78,52 68,72 Z" fill="#7A5A30" opacity="0.6"/>
        {/* Wrap horizontal bands */}
        <path d="M 68,80 Q 100,70 132,80" stroke="#5C3E1A" strokeWidth="2.5" fill="none"/>
        <path d="M 70,70 Q 100,60 130,70" stroke="#5C3E1A" strokeWidth="2" fill="none"/>
        <path d="M 76,58 Q 100,50 124,58" stroke="#5C3E1A" strokeWidth="1.5" fill="none"/>
        {/* Top knot/fold */}
        <path d="M 86,44 Q 100,38 114,44 Q 108,40 100,38 Q 92,40 86,44 Z" fill="#8A6838"/>
        {/* Front edge of wrap */}
        <path d="M 78,84 Q 82,72 90,60 Q 80,72 78,84 Z" fill="#6A4C24" opacity="0.5"/>
        {/* Brows */}
        <path d="M 81,78 L 89,72 L 96,74" stroke="#3A2810" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
        <path d="M 104,74 L 111,72 L 119,78" stroke="#3A2810" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
        {/* Eyes */}
        <path d="M 80,86 L 88,80 L 96,86 L 88,91 Z" fill="#0C0A0E"/>
        <circle cx="88" cy="86" r="3.4" fill="#3A2810"/>
        <circle cx="88" cy="86" r="2" fill="#060404"/>
        <circle cx="89.5" cy="84.5" r="1" fill="white" opacity="0.85"/>
        <path d="M 80,86 L 88,80.5 L 96,86" stroke="#0C0A0E" strokeWidth="1.5" fill="none"/>
        <path d="M 104,86 L 112,80 L 120,86 L 112,91 Z" fill="#0C0A0E"/>
        <circle cx="112" cy="86" r="3.4" fill="#3A2810"/>
        <circle cx="112" cy="86" r="2" fill="#060404"/>
        <circle cx="113.5" cy="84.5" r="1" fill="white" opacity="0.85"/>
        <path d="M 104,86 L 112,80.5 L 120,86" stroke="#0C0A0E" strokeWidth="1.5" fill="none"/>
        {/* Beard — short, geometric */}
        <path d="M 84,122 Q 88,128 100,130 Q 112,128 116,122 Q 112,126 100,128 Q 88,126 84,122 Z" fill="#3A2810" opacity="0.5"/>
        <path d="M 86,115 Q 100,120 114,115 Q 112,112 100,113 Q 88,112 86,115 Z" fill="#3A2810" opacity="0.35"/>
        {/* Nose */}
        <path d="M 98,100 L 96,108 L 100,110 L 104,108 L 102,100 Z" fill="#8A6030" opacity="0.2"/>
        {/* Mouth */}
        <path d="M 90,113 L 100,114 L 110,113" stroke="#7A4828" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
        <path d="M 90,113 Q 100,119 110,113" fill="#C09050" opacity="0.2"/>
      </g>
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════════
// STYLE C — SOFT LUXURY PORTRAIT
// Softer forms · restrained gradients · subtle lighting
// Polished hair texture · warm, human, premium feel
// ════════════════════════════════════════════════════════════════════

// C1: Short bob · warm light skin · female · soft structured jacket
function C1() {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',height:'100%',display:'block'}}>
      <defs>
        <radialGradient id="c1f" cx="44%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#F0DEC0"/><stop offset="40%" stopColor="#E0C8A0"/><stop offset="75%" stopColor="#C8A878"/><stop offset="100%" stopColor="#B09060"/>
        </radialGradient>
        <radialGradient id="c1h" cx="35%" cy="25%" r="75%">
          <stop offset="0%" stopColor="#3A2820"/><stop offset="50%" stopColor="#1C1410"/><stop offset="100%" stopColor="#0C0808"/>
        </radialGradient>
        <linearGradient id="c1j" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#2C2E3A"/><stop offset="100%" stopColor="#1A1C24"/>
        </linearGradient>
        <filter id="c1blur">
          <feGaussianBlur stdDeviation="0.6"/>
        </filter>
        <clipPath id="c1c"><circle cx="100" cy="100" r="100"/></clipPath>
      </defs>
      <circle cx="100" cy="100" r="100" fill="#181018"/>
      <g clipPath="url(#c1c)">
        {/* Structured jacket */}
        <path d="M 0,205 L 32,150 Q 58,138 80,134 L 84,127 L 100,144 L 116,127 L 120,134 Q 142,138 168,150 L 200,205 Z" fill="url(#c1j)"/>
        <path d="M 84,127 L 72,140 L 84,162 L 100,144 Z" fill="#343642"/>
        <path d="M 116,127 L 128,140 L 116,162 L 100,144 Z" fill="#343642"/>
        <path d="M 84,127 L 100,144 L 116,127 L 110,130 Q 100,140 90,130 Z" fill="#E8EAF0"/>
        {/* Neck */}
        <path d="M 89,122 L 89,136 Q 95,141 100,142 Q 105,141 111,136 L 111,122 L 107,126 Q 100,131 93,126 Z" fill="#D0B888"/>
        {/* Subtle neck shadow */}
        <ellipse cx="100" cy="125" rx="8" ry="5" fill="#C0A878" opacity="0.2" filter="url(#c1blur)"/>
        {/* Face — soft, organic */}
        <path d="M 72,84 Q 72,52 100,48 Q 128,52 128,84 Q 130,108 121,122 Q 112,132 100,134 Q 88,132 79,122 Q 70,108 72,84 Z" fill="url(#c1f)"/>
        {/* Soft ears */}
        <ellipse cx="71" cy="90" rx="5" ry="7" fill="#D8B880"/>
        <ellipse cx="129" cy="90" rx="5" ry="7" fill="#D8B880"/>
        {/* Warm forehead glow */}
        <ellipse cx="100" cy="66" rx="18" ry="12" fill="#F0E0B8" opacity="0.22" filter="url(#c1blur)"/>
        {/* Soft cheek blush */}
        <ellipse cx="82" cy="100" rx="10" ry="7" fill="#E8988A" opacity="0.14" filter="url(#c1blur)"/>
        <ellipse cx="118" cy="100" rx="10" ry="7" fill="#E8988A" opacity="0.14" filter="url(#c1blur)"/>
        {/* Chin shadow — soft */}
        <ellipse cx="100" cy="120" rx="14" ry="6" fill="#B09060" opacity="0.18" filter="url(#c1blur)"/>
        {/* Bob hair — soft volumetric mass */}
        <path d="M 72,84 Q 72,52 100,48 Q 128,52 128,84 Q 124,68 116,56 Q 108,47 100,46 Q 92,47 84,56 Q 76,68 72,84 Z" fill="url(#c1h)"/>
        {/* Bob sides — ends at jaw level, soft edge */}
        <path d="M 72,84 Q 68,96 70,108 Q 72,114 76,114 Q 80,114 80,108 Q 80,96 80,88 Z" fill="#1C1410"/>
        <path d="M 128,84 Q 132,96 130,108 Q 128,114 124,114 Q 120,114 120,108 Q 120,96 120,88 Z" fill="#1C1410"/>
        {/* Hair highlight — soft painted streak */}
        <path d="M 88,50 Q 96,46 106,48 Q 98,46 92,47 Q 88,48 86,52 Z" fill="#4A3828" opacity="0.65" filter="url(#c1blur)"/>
        {/* Hair body lighting */}
        <ellipse cx="94" cy="56" rx="10" ry="6" fill="#3A2820" opacity="0.5" filter="url(#c1blur)"/>
        {/* Brows — soft, natural */}
        <path d="M 80,76 Q 87,71 94,73" stroke="#2A1A10" strokeWidth="1.8" fill="none" strokeLinecap="round" filter="url(#c1blur)"/>
        <path d="M 106,73 Q 113,71 120,76" stroke="#2A1A10" strokeWidth="1.8" fill="none" strokeLinecap="round" filter="url(#c1blur)"/>
        {/* Soft eye shadow */}
        <ellipse cx="87" cy="83" rx="10" ry="6" fill="#C0906A" opacity="0.1" filter="url(#c1blur)"/>
        <ellipse cx="113" cy="83" rx="10" ry="6" fill="#C0906A" opacity="0.1" filter="url(#c1blur)"/>
        {/* Left eye */}
        <path d="M 79,83 Q 87,77 95,83 Q 87,89 79,83 Z" fill="#100E14"/>
        <circle cx="87" cy="83" r="3.5" fill="#4A3420"/>
        <circle cx="87" cy="83" r="2" fill="#060408"/>
        <circle cx="88.4" cy="81.4" r="1.1" fill="white" opacity="0.88"/>
        <path d="M 79,83 Q 87,77.5 95,83" stroke="#100E14" strokeWidth="1.4" fill="none"/>
        {/* Right eye */}
        <path d="M 105,83 Q 113,77 121,83 Q 113,89 105,83 Z" fill="#100E14"/>
        <circle cx="113" cy="83" r="3.5" fill="#4A3420"/>
        <circle cx="113" cy="83" r="2" fill="#060408"/>
        <circle cx="114.4" cy="81.4" r="1.1" fill="white" opacity="0.88"/>
        <path d="M 105,83 Q 113,77.5 121,83" stroke="#100E14" strokeWidth="1.4" fill="none"/>
        {/* Nose — gradient shadow, very soft */}
        <ellipse cx="96" cy="103" rx="4" ry="2.5" fill="#B08060" opacity="0.22" filter="url(#c1blur)"/>
        <ellipse cx="104" cy="103" rx="4" ry="2.5" fill="#B08060" opacity="0.22" filter="url(#c1blur)"/>
        <ellipse cx="100" cy="100" rx="3" ry="2.5" fill="#F0DEB8" opacity="0.18" filter="url(#c1blur)"/>
        {/* Mouth — soft, warm */}
        <path d="M 90,111 Q 95,108 100,109 Q 105,108 110,111" stroke="#8A5030" strokeWidth="1.3" fill="none"/>
        <path d="M 90,111 Q 100,118 110,111" fill="#D0906A" opacity="0.3"/>
        <ellipse cx="100" cy="113" rx="5.5" ry="2.5" fill="#E0A888" opacity="0.18" filter="url(#c1blur)"/>
      </g>
    </svg>
  );
}

// C2: Natural coily · rich dark skin · female · warm casual luxe
function C2() {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',height:'100%',display:'block'}}>
      <defs>
        <radialGradient id="c2f" cx="38%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#7A4228"/><stop offset="45%" stopColor="#5A2E16"/><stop offset="80%" stopColor="#3E1C08"/><stop offset="100%" stopColor="#2A1004"/>
        </radialGradient>
        <radialGradient id="c2h" cx="40%" cy="30%" r="72%">
          <stop offset="0%" stopColor="#221808"/><stop offset="60%" stopColor="#100C04"/><stop offset="100%" stopColor="#060402"/>
        </radialGradient>
        <linearGradient id="c2t" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#3A2010"/><stop offset="100%" stopColor="#241408"/>
        </linearGradient>
        <filter id="c2b"><feGaussianBlur stdDeviation="0.7"/></filter>
        <clipPath id="c2c"><circle cx="100" cy="100" r="100"/></clipPath>
      </defs>
      <circle cx="100" cy="100" r="100" fill="#100E08"/>
      <g clipPath="url(#c2c)">
        {/* Warm casual top */}
        <path d="M 0,205 L 36,152 Q 60,140 82,136 L 86,130 L 100,146 L 114,130 L 118,136 Q 140,140 164,152 L 200,205 Z" fill="url(#c2t)"/>
        <path d="M 86,130 Q 100,146 114,130 Q 108,138 100,140 Q 92,138 86,130 Z" fill="#3A2010"/>
        {/* Neck */}
        <path d="M 89,124 L 89,136 Q 95,141 100,142 Q 105,141 111,136 L 111,124 L 107,128 Q 100,132 93,128 Z" fill="#4E2410"/>
        {/* Face */}
        <path d="M 73,84 Q 73,52 100,48 Q 127,52 127,84 Q 129,108 120,122 Q 111,132 100,134 Q 89,132 80,122 Q 71,108 73,84 Z" fill="url(#c2f)"/>
        {/* Warm forehead highlight */}
        <ellipse cx="100" cy="62" rx="16" ry="11" fill="#8A4A2A" opacity="0.22" filter="url(#c2b)"/>
        {/* Cheekbone warmth */}
        <ellipse cx="82" cy="100" rx="9" ry="6" fill="#9A5830" opacity="0.25" filter="url(#c2b)"/>
        <ellipse cx="118" cy="100" rx="9" ry="6" fill="#9A5830" opacity="0.25" filter="url(#c2b)"/>
        {/* Natural coily hair — soft organic mass with warmth */}
        <ellipse cx="100" cy="54" rx="42" ry="38" fill="url(#c2h)"/>
        <ellipse cx="68" cy="68" rx="14" ry="18" fill="#0C0804"/>
        <ellipse cx="132" cy="68" rx="14" ry="18" fill="#0C0804"/>
        {/* Organic silhouette — varied bumps, softer than Style B */}
        <ellipse cx="86" cy="30" rx="12" ry="10" fill="#0A0804" filter="url(#c2b)"/>
        <ellipse cx="114" cy="32" rx="10" ry="9" fill="#0C0A06" filter="url(#c2b)"/>
        <ellipse cx="70" cy="52" rx="9" ry="12" fill="#0A0804" filter="url(#c2b)"/>
        <ellipse cx="130" cy="54" rx="9" ry="12" fill="#0A0804" filter="url(#c2b)"/>
        <ellipse cx="100" cy="26" rx="8" ry="7" fill="#080604" filter="url(#c2b)"/>
        {/* Hair warmth/sheen — more elaborate than B */}
        <ellipse cx="96" cy="44" rx="14" ry="7" fill="#2A1C08" opacity="0.6" filter="url(#c2b)"/>
        <ellipse cx="74" cy="62" rx="6" ry="8" fill="#1A1206" opacity="0.5" filter="url(#c2b)"/>
        {/* Hair meets forehead */}
        <path d="M 80,82 Q 88,72 100,70 Q 112,72 120,82" fill="#0E0C08"/>
        {/* Ears */}
        <ellipse cx="72" cy="92" rx="4.5" ry="6" fill="#3E1C08" filter="url(#c2b)"/>
        <ellipse cx="128" cy="92" rx="4.5" ry="6" fill="#3E1C08" filter="url(#c2b)"/>
        {/* Brows */}
        <path d="M 80,77 Q 87,72 95,74" stroke="#1A0C04" strokeWidth="2" fill="none" strokeLinecap="round" filter="url(#c2b)"/>
        <path d="M 105,74 Q 113,72 120,77" stroke="#1A0C04" strokeWidth="2" fill="none" strokeLinecap="round" filter="url(#c2b)"/>
        {/* Eyes */}
        <path d="M 79,84 Q 87,78.5 95,84 Q 87,89.5 79,84 Z" fill="#0A0806"/>
        <circle cx="87" cy="84" r="3.4" fill="#2A1808"/>
        <circle cx="87" cy="84" r="2" fill="#040202"/>
        <circle cx="88.4" cy="82.4" r="1.1" fill="white" opacity="0.85"/>
        <path d="M 79,84 Q 87,79 95,84" stroke="#0A0806" strokeWidth="1.4" fill="none"/>
        <path d="M 105,84 Q 113,78.5 121,84 Q 113,89.5 105,84 Z" fill="#0A0806"/>
        <circle cx="113" cy="84" r="3.4" fill="#2A1808"/>
        <circle cx="113" cy="84" r="2" fill="#040202"/>
        <circle cx="114.4" cy="82.4" r="1.1" fill="white" opacity="0.85"/>
        <path d="M 105,84 Q 113,79 121,84" stroke="#0A0806" strokeWidth="1.4" fill="none"/>
        {/* Nose */}
        <ellipse cx="95.5" cy="103" rx="4" ry="2.5" fill="#2E1008" opacity="0.35" filter="url(#c2b)"/>
        <ellipse cx="104.5" cy="103" rx="4" ry="2.5" fill="#2E1008" opacity="0.35" filter="url(#c2b)"/>
        {/* Mouth — warm, full */}
        <path d="M 90,111 Q 95,108 100,109.5 Q 105,108 110,111" stroke="#4A1C08" strokeWidth="1.4" fill="none"/>
        <path d="M 90,111 Q 100,118.5 110,111" fill="#8A4018" opacity="0.32"/>
        <ellipse cx="100" cy="114" rx="5.5" ry="2.5" fill="#A05028" opacity="0.2" filter="url(#c2b)"/>
      </g>
    </svg>
  );
}

// C3: Long wavy · medium olive · female · elegant draped neckline
function C3() {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',height:'100%',display:'block'}}>
      <defs>
        <radialGradient id="c3f" cx="42%" cy="32%" r="66%">
          <stop offset="0%" stopColor="#D8B888"/><stop offset="45%" stopColor="#BEA068"/><stop offset="80%" stopColor="#A08050"/><stop offset="100%" stopColor="#887040"/>
        </radialGradient>
        <linearGradient id="c3h" x1="0.25" y1="0" x2="0.65" y2="1">
          <stop offset="0%" stopColor="#2A1E14"/><stop offset="40%" stopColor="#140E08"/><stop offset="100%" stopColor="#080604"/>
        </linearGradient>
        <linearGradient id="c3t" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#2A1C28"/><stop offset="100%" stopColor="#1A1018"/>
        </linearGradient>
        <filter id="c3b"><feGaussianBlur stdDeviation="0.6"/></filter>
        <clipPath id="c3c"><circle cx="100" cy="100" r="100"/></clipPath>
      </defs>
      <circle cx="100" cy="100" r="100" fill="#18100E"/>
      <g clipPath="url(#c3c)">
        {/* Elegant top — draped neckline */}
        <path d="M 0,205 L 34,152 Q 58,140 80,136 L 84,128 L 100,145 L 116,128 L 120,136 Q 142,140 166,152 L 200,205 Z" fill="url(#c3t)"/>
        <path d="M 84,128 Q 100,145 116,128 Q 110,138 100,141 Q 90,138 84,128 Z" fill="#321624"/>
        {/* Long wavy hair behind face — left side */}
        <path d="M 70,80 Q 64,100 58,126 Q 52,148 54,165 Q 56,170 62,165 Q 66,152 68,130 Q 70,110 72,90 Z" fill="url(#c3h)"/>
        {/* Wavy edge left */}
        <path d="M 60,100 Q 62,108 58,116 Q 56,124 60,132" stroke="#1E1408" strokeWidth="2" fill="none"/>
        <path d="M 64,108 Q 62,118 66,126 Q 68,134 64,142" stroke="#261A0A" strokeWidth="1.5" fill="none"/>
        {/* Long wavy hair — right side */}
        <path d="M 130,80 Q 136,100 142,126 Q 148,148 146,165 Q 144,170 138,165 Q 134,152 132,130 Q 130,110 128,90 Z" fill="url(#c3h)"/>
        {/* Neck */}
        <path d="M 89,123 L 89,136 Q 95,141 100,142 Q 105,141 111,136 L 111,123 L 107,127 Q 100,131 93,127 Z" fill="#B09050"/>
        {/* Face */}
        <path d="M 72,84 Q 72,52 100,48 Q 128,52 128,84 Q 130,108 121,122 Q 112,132 100,134 Q 88,132 79,122 Q 70,108 72,84 Z" fill="url(#c3f)"/>
        <ellipse cx="71" cy="90" rx="4.5" ry="6" fill="#B09050" filter="url(#c3b)"/>
        <ellipse cx="129" cy="90" rx="4.5" ry="6" fill="#B09050" filter="url(#c3b)"/>
        {/* Warm forehead */}
        <ellipse cx="100" cy="64" rx="18" ry="12" fill="#D8C090" opacity="0.2" filter="url(#c3b)"/>
        {/* Soft cheek */}
        <ellipse cx="82" cy="100" rx="10" ry="7" fill="#D8988A" opacity="0.12" filter="url(#c3b)"/>
        <ellipse cx="118" cy="100" rx="10" ry="7" fill="#D8988A" opacity="0.12" filter="url(#c3b)"/>
        {/* Long wavy hair — top/front */}
        <path d="M 72,84 Q 72,52 100,48 Q 128,52 128,84 Q 122,68 116,56 Q 108,47 100,46 Q 92,47 84,56 Q 78,68 72,84 Z" fill="#180E08"/>
        {/* Center part */}
        <line x1="100" y1="46" x2="100" y2="64" stroke="#2A1A10" strokeWidth="1.2" opacity="0.4"/>
        {/* Wavy hair highlights — painted strands */}
        <path d="M 84,52 Q 88,58 84,66 Q 80,72 82,78" stroke="#3A2A18" strokeWidth="1.5" fill="none" opacity="0.6"/>
        <path d="M 90,48 Q 92,54 90,62 Q 88,70 90,76" stroke="#2A1E10" strokeWidth="1.5" fill="none" opacity="0.5"/>
        <path d="M 78,64 Q 76,72 78,82" stroke="#3A2A18" strokeWidth="1.2" fill="none" opacity="0.4"/>
        {/* Brows */}
        <path d="M 80,76 Q 87,71 94,73" stroke="#3A2010" strokeWidth="1.9" fill="none" strokeLinecap="round" filter="url(#c3b)"/>
        <path d="M 106,73 Q 113,71 120,76" stroke="#3A2010" strokeWidth="1.9" fill="none" strokeLinecap="round" filter="url(#c3b)"/>
        {/* Eye shadow */}
        <ellipse cx="87" cy="83" rx="10" ry="6" fill="#A07840" opacity="0.1" filter="url(#c3b)"/>
        <ellipse cx="113" cy="83" rx="10" ry="6" fill="#A07840" opacity="0.1" filter="url(#c3b)"/>
        {/* Eyes */}
        <path d="M 79,83 Q 87,77.5 95,83 Q 87,88.5 79,83 Z" fill="#0E0C10"/>
        <circle cx="87" cy="83" r="3.5" fill="#4A3020"/>
        <circle cx="87" cy="83" r="2" fill="#060408"/>
        <circle cx="88.5" cy="81.4" r="1.1" fill="white" opacity="0.88"/>
        <path d="M 79,83 Q 87,78 95,83" stroke="#0E0C10" strokeWidth="1.4" fill="none"/>
        <path d="M 105,83 Q 113,77.5 121,83 Q 113,88.5 105,83 Z" fill="#0E0C10"/>
        <circle cx="113" cy="83" r="3.5" fill="#4A3020"/>
        <circle cx="113" cy="83" r="2" fill="#060408"/>
        <circle cx="114.5" cy="81.4" r="1.1" fill="white" opacity="0.88"/>
        <path d="M 105,83 Q 113,78 121,83" stroke="#0E0C10" strokeWidth="1.4" fill="none"/>
        {/* Nose */}
        <ellipse cx="96" cy="103" rx="4" ry="2.5" fill="#9A7040" opacity="0.24" filter="url(#c3b)"/>
        <ellipse cx="104" cy="103" rx="4" ry="2.5" fill="#9A7040" opacity="0.24" filter="url(#c3b)"/>
        {/* Mouth */}
        <path d="M 90,111 Q 95,108 100,109.5 Q 105,108 110,111" stroke="#7A4828" strokeWidth="1.3" fill="none"/>
        <path d="M 90,111 Q 100,118.5 110,111" fill="#C89060" opacity="0.3"/>
        <ellipse cx="100" cy="113.5" rx="5" ry="2.5" fill="#D4A870" opacity="0.18" filter="url(#c3b)"/>
      </g>
    </svg>
  );
}

// C4: Soft headscarf · warm medium-dark skin · female · flowing draped top
function C4() {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',height:'100%',display:'block'}}>
      <defs>
        <radialGradient id="c4f" cx="40%" cy="32%" r="65%">
          <stop offset="0%" stopColor="#B07848"/><stop offset="45%" stopColor="#946030"/><stop offset="80%" stopColor="#7A4A1C"/><stop offset="100%" stopColor="#623C14"/>
        </radialGradient>
        <linearGradient id="c4s" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#7A5C3A"/><stop offset="40%" stopColor="#5A4228"/><stop offset="100%" stopColor="#3E2A14"/>
        </linearGradient>
        <linearGradient id="c4t" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#D4C8B8"/><stop offset="100%" stopColor="#BEB0A0"/>
        </linearGradient>
        <filter id="c4b"><feGaussianBlur stdDeviation="0.7"/></filter>
        <clipPath id="c4c"><circle cx="100" cy="100" r="100"/></clipPath>
      </defs>
      <circle cx="100" cy="100" r="100" fill="#100E18"/>
      <g clipPath="url(#c4c)">
        {/* Flowing draped top */}
        <path d="M 0,205 L 30,154 Q 56,141 78,137 L 82,131 L 100,147 L 118,131 L 122,137 Q 144,141 170,154 L 200,205 Z" fill="url(#c4t)"/>
        <path d="M 82,131 Q 100,147 118,131 Q 112,141 100,144 Q 88,141 82,131 Z" fill="#C8BCA8"/>
        {/* Silk headscarf — soft, with fabric drape over shoulders */}
        {/* Shoulder drape — left */}
        <path d="M 32,154 Q 50,134 66,118 Q 58,124 52,136 Q 42,146 32,154 Z" fill="#6A4E2A" opacity="0.9"/>
        <path d="M 38,148 Q 52,132 64,120" stroke="#7A5E36" strokeWidth="1.5" fill="none" opacity="0.5"/>
        {/* Shoulder drape — right */}
        <path d="M 168,154 Q 150,134 134,118 Q 142,124 148,136 Q 158,146 168,154 Z" fill="#6A4E2A" opacity="0.9"/>
        <path d="M 162,148 Q 148,132 136,120" stroke="#7A5E36" strokeWidth="1.5" fill="none" opacity="0.5"/>
        {/* Main scarf body — wraps head, soft folds */}
        <path d="M 64,88 Q 62,66 72,52 Q 82,38 100,36 Q 118,38 128,52 Q 138,66 136,88 Q 130,108 124,122 Q 118,136 118,131 L 82,131 Q 82,136 76,122 Q 70,108 64,88 Z" fill="url(#c4s)"/>
        {/* Scarf highlight — fabric sheen */}
        <path d="M 78,48 Q 88,40 100,38 Q 112,40 122,48 Q 112,42 100,40 Q 88,42 78,48 Z" fill="#8A6A3A" opacity="0.55" filter="url(#c4b)"/>
        {/* Fabric fold lines — soft */}
        <path d="M 66,86 Q 70,70 78,56" stroke="#7A5830" strokeWidth="1.5" fill="none" opacity="0.4"/>
        <path d="M 134,86 Q 130,70 122,56" stroke="#7A5830" strokeWidth="1.5" fill="none" opacity="0.4"/>
        {/* Front edge of scarf framing face */}
        <path d="M 74,88 Q 78,74 86,62" stroke="#5A3E1A" strokeWidth="1.2" fill="none" opacity="0.5"/>
        <path d="M 126,88 Q 122,74 114,62" stroke="#5A3E1A" strokeWidth="1.2" fill="none" opacity="0.5"/>
        {/* Small gathered scarf detail at top */}
        <path d="M 88,40 Q 100,36 112,40 Q 106,38 100,37 Q 94,38 88,40 Z" fill="#7A5A2A" opacity="0.6"/>
        {/* Neck */}
        <path d="M 89,124 L 89,137 Q 95,142 100,143 Q 105,142 111,137 L 111,124 L 107,128 Q 100,132 93,128 Z" fill="#8A5828"/>
        {/* Face */}
        <path d="M 76,88 Q 76,58 100,54 Q 124,58 124,88 Q 126,110 117,124 Q 109,133 100,134 Q 91,133 83,124 Q 74,110 76,88 Z" fill="url(#c4f)"/>
        {/* Warm light on forehead */}
        <ellipse cx="100" cy="68" rx="16" ry="10" fill="#C08850" opacity="0.22" filter="url(#c4b)"/>
        {/* Cheek warmth */}
        <ellipse cx="83" cy="104" rx="9" ry="6" fill="#C08040" opacity="0.18" filter="url(#c4b)"/>
        <ellipse cx="117" cy="104" rx="9" ry="6" fill="#C08040" opacity="0.18" filter="url(#c4b)"/>
        {/* Chin shadow */}
        <ellipse cx="100" cy="122" rx="13" ry="5" fill="#6A3C14" opacity="0.2" filter="url(#c4b)"/>
        {/* Brows */}
        <path d="M 83,81 Q 90,76 97,78" stroke="#3A2010" strokeWidth="1.9" fill="none" strokeLinecap="round" filter="url(#c4b)"/>
        <path d="M 103,78 Q 110,76 117,81" stroke="#3A2010" strokeWidth="1.9" fill="none" strokeLinecap="round" filter="url(#c4b)"/>
        {/* Eyes */}
        <path d="M 81,88 Q 89,82 97,88 Q 89,93.5 81,88 Z" fill="#0E0C10"/>
        <circle cx="89" cy="88" r="3.5" fill="#3A2010"/>
        <circle cx="89" cy="88" r="2" fill="#060408"/>
        <circle cx="90.4" cy="86.4" r="1.1" fill="white" opacity="0.88"/>
        <path d="M 81,88 Q 89,82.5 97,88" stroke="#0E0C10" strokeWidth="1.4" fill="none"/>
        <path d="M 103,88 Q 111,82 119,88 Q 111,93.5 103,88 Z" fill="#0E0C10"/>
        <circle cx="111" cy="88" r="3.5" fill="#3A2010"/>
        <circle cx="111" cy="88" r="2" fill="#060408"/>
        <circle cx="112.4" cy="86.4" r="1.1" fill="white" opacity="0.88"/>
        <path d="M 103,88 Q 111,82.5 119,88" stroke="#0E0C10" strokeWidth="1.4" fill="none"/>
        {/* Nose */}
        <ellipse cx="95.5" cy="106" rx="4" ry="2.5" fill="#6A3C14" opacity="0.3" filter="url(#c4b)"/>
        <ellipse cx="104.5" cy="106" rx="4" ry="2.5" fill="#6A3C14" opacity="0.3" filter="url(#c4b)"/>
        {/* Mouth */}
        <path d="M 90,114 Q 95,111 100,112.5 Q 105,111 110,114" stroke="#6A3814" strokeWidth="1.3" fill="none"/>
        <path d="M 90,114 Q 100,121 110,114" fill="#B07030" opacity="0.28"/>
        <ellipse cx="100" cy="116.5" rx="5" ry="2.5" fill="#C08848" opacity="0.16" filter="url(#c4b)"/>
      </g>
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════════
// LAB DISPLAY
// ════════════════════════════════════════════════════════════════════

const STYLES = [
  {
    key: 'A', label: 'Style A', title: 'Premium Editorial Vector',
    accent: '#3B82F6',
    desc: 'Mature proportions · sculpted hair masses · 2–3 tone shading · minimal outlines. Calibrated for refined mobility and startup contexts.',
    impl: 'Each feature (hair mass, face, eyes, clothing) is a discrete SVG layer. Interchangeable by swapping path + fill pairs per trait. Color variation via gradient token swaps on the face layer.',
    avatars: [A1, A2, A3, A4],
    labels: ['Short · light olive · structured jacket', 'Natural · medium-dark · gold glasses', 'Braids · deep dark · elegant top', 'Hijab · warm medium · ivory collar'],
  },
  {
    key: 'B', label: 'Style B', title: 'Sculpted Minimal Vector',
    accent: '#64748B',
    desc: 'Geometric construction · sharp silhouettes · controlled facial detail. Highly readable at 48px. No emoji or cartoon feeling.',
    impl: 'Strict geometric primitives. Hair is a single angular path. Eyes use a diamond/rhombus path. Very few gradient IDs needed. Easiest to make interchangeable — swap geometry, not organic shapes.',
    avatars: [B1, B2, B3, B4],
    labels: ['Short geometric · warm medium · turtleneck', 'Coily · porcelain · black top', 'Straight long · deep dark · button-up', 'Turban · warm medium-light · hoodie + beard'],
  },
  {
    key: 'C', label: 'Style C', title: 'Soft Luxury Portrait',
    accent: '#D97706',
    desc: 'Softer facial forms · restrained gradients · warm lighting on face and hair. Clearly vector-based, consistent across skin tones.',
    impl: 'Heavy use of radialGradient + feGaussianBlur. Soft transitions require more gradient stops. Interchangeable but blur filters must be scoped per layer. Highest visual impact at 96px+.',
    avatars: [C1, C2, C3, C4],
    labels: ['Short bob · warm light · soft jacket', 'Natural coily · rich dark · warm casual', 'Long wavy · olive medium · elegant drape', 'Headscarf · warm medium-dark · draped top'],
  },
];

const SIZES = [180, 96, 48];

export function ParsonaStyleLabView() {
  const [bg, setBg] = useState<'dark-ui' | 'neutral'>('dark-ui');
  const bgColor = bg === 'dark-ui' ? '#030812' : '#111118';

  return (
    <div style={{ minHeight: '100vh', background: bgColor, color: '#E2E8F0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #1e293b' }}>
        <div style={{ fontSize: 10, color: '#3B82F6', fontWeight: 700, letterSpacing: '0.14em', marginBottom: 6 }}>
          DEV ONLY · PARSONA STYLE LAB · ?qa=parsona-style-lab
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.02em' }}>
          Parsona Art Direction Study
        </h1>
        <p style={{ margin: '4px 0 12px', fontSize: 12, color: '#64748B', maxWidth: 540 }}>
          Three premium directions — none reuse current asset geometry. All designed to read as mature, human, and brand-appropriate beside premium mobility apps.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['dark-ui', 'neutral'] as const).map(b => (
            <button key={b} onClick={() => setBg(b)} style={{
              padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: bg === b ? '#1e40af' : '#1e293b', color: bg === b ? '#DBEAFE' : '#94A3B8'
            }}>
              {b === 'dark-ui' ? 'ParQueen UI bg (#030812)' : 'Neutral dark (#111118)'}
            </button>
          ))}
        </div>
      </div>

      {/* Three directions */}
      <div style={{ padding: '24px 16px 0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, maxWidth: 1200, margin: '0 auto' }}>
        {STYLES.map(style => (
          <div key={style.key}>
            {/* Style header */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: style.accent, background: `${style.accent}18`, padding: '2px 8px', borderRadius: 4, marginBottom: 6 }}>
                {style.label}
              </div>
              <h2 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#F1F5F9' }}>{style.title}</h2>
              <p style={{ margin: 0, fontSize: 11, color: '#64748B', lineHeight: 1.5 }}>{style.desc}</p>
            </div>
            {/* 2×2 avatar grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {style.avatars.map((Avatar, i) => (
                <div key={i}>
                  <div style={{ width: '100%', aspectRatio: '1', borderRadius: '50%', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
                    <Avatar />
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 9.5, color: '#475569', lineHeight: 1.3, textAlign: 'center' }}>{style.labels[i]}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Size comparison */}
      <div style={{ padding: '28px 16px 0', maxWidth: 1200, margin: '0 auto' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Size Comparison — first avatar from each direction
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ fontSize: 11, color: '#475569', fontWeight: 600, textAlign: 'left', padding: '0 0 10px', width: 80 }}>Size</th>
                {STYLES.map(s => (
                  <th key={s.key} style={{ fontSize: 11, color: s.accent, fontWeight: 700, textAlign: 'center', padding: '0 16px 10px', letterSpacing: '0.08em' }}>{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SIZES.map(sz => (
                <tr key={sz} style={{ borderTop: '1px solid #1e293b' }}>
                  <td style={{ padding: '14px 0', fontSize: 11, color: '#475569', verticalAlign: 'middle' }}>{sz}px</td>
                  {STYLES.map(s => {
                    const Avatar = s.avatars[0];
                    return (
                      <td key={s.key} style={{ padding: 14, textAlign: 'center', verticalAlign: 'middle' }}>
                        <div style={{ display: 'inline-block', width: sz, height: sz, borderRadius: '50%', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                          <Avatar />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Technical implementation notes */}
      <div style={{ padding: '28px 16px 40px', maxWidth: 1200, margin: '0 auto' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Layered Asset Architecture — per direction
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {STYLES.map(style => (
            <div key={style.key} style={{ background: '#0f172a', borderRadius: 10, padding: 16, border: `1px solid ${style.accent}28` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: style.accent, marginBottom: 8, letterSpacing: '0.08em' }}>{style.label} — {style.title}</div>
              <p style={{ margin: 0, fontSize: 11, color: '#64748B', lineHeight: 1.7 }}>{style.impl}</p>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {['Face + skin', 'Hair mass', 'Eyes + brows', 'Nose shadow', 'Mouth', 'Clothing + collar'].map(layer => (
                  <div key={layer} style={{ fontSize: 10, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: 2, background: style.accent, opacity: 0.5 }}/>
                    {layer}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Quick comparison table */}
        <div style={{ marginTop: 24, background: '#0f172a', borderRadius: 10, overflow: 'hidden', border: '1px solid #1e293b' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#1e293b' }}>
                {['Criterion', 'Style A · Editorial', 'Style B · Minimal', 'Style C · Soft Luxury'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#94A3B8', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Maturity at 180px', '★★★★★', '★★★★☆', '★★★★★'],
                ['Readability at 48px', '★★★☆☆', '★★★★★', '★★★☆☆'],
                ['Premium feel', '★★★★★', '★★★★☆', '★★★★★'],
                ['Layer interchangeability', '★★★★☆', '★★★★★', '★★★☆☆'],
                ['Skin tone flexibility', '★★★★☆', '★★★☆☆', '★★★★★'],
                ['Production complexity', 'Medium', 'Low', 'High'],
                ['Brand fit (mobility app)', '★★★★★', '★★★★☆', '★★★★☆'],
              ].map(([crit, a, b, c], i) => (
                <tr key={i} style={{ borderTop: '1px solid #1e293b' }}>
                  <td style={{ padding: '9px 14px', color: '#64748B', fontWeight: 600 }}>{crit}</td>
                  <td style={{ padding: '9px 14px', color: '#3B82F6' }}>{a}</td>
                  <td style={{ padding: '9px 14px', color: '#94A3B8' }}>{b}</td>
                  <td style={{ padding: '9px 14px', color: '#D97706' }}>{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
