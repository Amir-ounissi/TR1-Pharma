/** Animated editorial illustration of the same pharmacy across the sell-in to sell-out journey. */
export function PharmacyIllustration() {
  return (
    <svg viewBox="0 0 560 410" fill="none" role="img" aria-label="Parcours animé dans une même pharmacie : implantation de la gamme, formation de l’équipe, puis conseil à une cliente et vente.">
      <style>{`
        .tr1-scene { animation: tr1-scene-cycle 12s linear infinite; }
        .tr1-scene-two { animation-delay: -8s; }
        .tr1-scene-three { animation-delay: -4s; }
        .tr1-product { transform-box: fill-box; transform-origin: center bottom; animation: tr1-product-breathe 2.5s ease-in-out infinite; }
        @keyframes tr1-scene-cycle {
          0%, 29% { opacity: 1; transform: translateY(0); }
          33%, 96% { opacity: 0; transform: translateY(5px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes tr1-product-breathe {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .tr1-scene, .tr1-product { animation: none; }
          .tr1-scene-two, .tr1-scene-three { display: none; }
        }
      `}</style>

      {/* Permanent scenery: a soft architectural cutaway, not three separate slides. */}
      <path d="M51 284C27 209 81 87 187 55C293 22 440 52 493 161C548 273 474 364 343 368C207 372 80 370 51 284Z" fill="#e7dfd0" />
      <circle cx="484" cy="87" r="24" fill="#ea7015" />
      <path d="M47 139H77M62 124V154" stroke="#b8ad99" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M47 354H521" stroke="#b8ad99" strokeWidth="1.5" strokeLinecap="round" />
      <ellipse cx="279" cy="354" rx="213" ry="9" fill="#d8cebc" fillOpacity=".5" />

      <path d="M83 339V137C83 101 111 73 147 73H422C458 73 486 101 486 137V339" fill="#fffdf8" stroke="#0e1d31" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M95 143H474" stroke="#0e1d31" strokeWidth="1.7" />
      <path d="M97 151H472V338H97Z" fill="#f5f1e9" />
      <path d="M108 151V334M463 151V334" stroke="#c5b9a8" strokeWidth="1.1" />
      <path d="M96 338H474" stroke="#0e1d31" strokeWidth="2" strokeLinecap="round" />
      <path d="M103 133C106 105 124 86 153 86H323" stroke="#e3dbcc" strokeWidth="2" strokeLinecap="round" />
      <text x="125" y="119" fill="#0e1d31" fontFamily="Arial, sans-serif" fontSize="18" fontWeight="700" letterSpacing="2.5">PHARMACIE</text>
      <path d="M429 98V125M415.5 111.5H442.5" stroke="#ad4b08" strokeWidth="7" strokeLinecap="square" />

      {/* Back shelves remain identical through every part of the sequence. */}
      <rect x="326" y="169" width="116" height="107" rx="2" fill="#fffdf8" stroke="#c5b9a8" strokeWidth="1.4" />
      <path d="M334 204H434M334 240H434" stroke="#b8ad99" strokeWidth="1.8" />
      <rect x="338" y="182" width="15" height="22" rx="2" fill="#c2b298" />
      <rect x="360" y="187" width="12" height="17" rx="2" fill="#cf7739" />
      <rect x="379" y="179" width="17" height="25" rx="2" fill="#162a45" />
      <rect x="403" y="184" width="14" height="20" rx="2" fill="#ddd4c3" />
      <path d="M342 189H350M363 194H369M383 187H391M406 192H414" stroke="#fffdf8" strokeWidth="1.4" />
      <rect x="341" y="214" width="16" height="26" rx="2" fill="#fffdf8" stroke="#c2b298" strokeWidth="1" />
      <rect x="365" y="220" width="19" height="20" rx="2" fill="#cf7739" />
      <rect x="393" y="214" width="12" height="26" rx="3" fill="#162a45" />
      <rect x="410" y="219" width="17" height="21" rx="2" fill="#c2b298" />
      <path d="M345 224H353M369 228H379M413 227H423" stroke="#fffdf8" strokeWidth="1.4" />
      <path d="M108 300H141M124.5 300V269M124 283L111 274M124 281L136 270" stroke="#0e1d31" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M123 280C111 274 110 260 116 254C125 260 129 271 123 280ZM127 291C128 275 139 271 147 274C147 284 137 291 127 291Z" fill="#c2b298" />
      <path d="M109 301H141L137 328H113L109 301Z" fill="#cf7739" stroke="#0e1d31" strokeWidth="1.4" />

      {/* 01 · Sell-in: the TR1 representative presents the range to a pharmacist. */}
      <g className="tr1-scene">
        <path d="M159 236L152 262L143 294M189 236L199 270L208 291" stroke="#0e1d31" strokeWidth="2" strokeLinecap="round" />
        <path d="M160 231Q175 218 190 231L196 303H153L160 231Z" fill="#162a45" stroke="#0e1d31" strokeWidth="1.6" />
        <path d="M171 232L175 249L181 231" fill="#fffdf8" stroke="#0e1d31" strokeWidth="1.1" />
        <path d="M174 248V286" stroke="#c2b298" strokeWidth="1.4" />
        <path d="M191 241L223 260L250 257" stroke="#0e1d31" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M191 241L223 260L250 257" stroke="#162a45" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="175" cy="208" r="19" fill="#e4ba94" stroke="#0e1d31" strokeWidth="1.5" />
        <path d="M157 209C153 189 164 182 175 182C189 182 197 194 193 207C184 202 176 196 163 200Z" fill="#162a45" />
        <path d="M121 277H144V309H121Z" fill="#c2b298" stroke="#0e1d31" strokeWidth="1.4" />
        <path d="M127 277V270H138V277" stroke="#0e1d31" strokeWidth="1.4" />
        <circle cx="285" cy="207" r="19" fill="#e4ba94" stroke="#0e1d31" strokeWidth="1.5" />
        <path d="M267 206C265 187 276 184 285 184C296 184 302 193 303 207" fill="#5b4a3e" />
        <path d="M269 235Q285 225 302 235L308 310H262L269 235Z" fill="#fffdf8" stroke="#0e1d31" strokeWidth="1.5" />
        <path d="M283 235V306M269 244L280 260L285 247M301 244L290 260" stroke="#b8ad99" strokeWidth="1.4" />
        <path d="M270 246L257 263" stroke="#fffdf8" strokeWidth="9" strokeLinecap="round" />
        <path d="M270 246L257 263" stroke="#0e1d31" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="255" cy="263" r="4" fill="#e4ba94" />
        <text x="282" y="377" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="13" fontWeight="700" letterSpacing="1.3" fill="#ad4b08">01  /  IMPLANTER LA GAMME</text>
      </g>

      {/* 02 · Same shop, now the representative trains the pharmacy team. */}
      <g className="tr1-scene tr1-scene-two">
        <circle cx="164" cy="212" r="18" fill="#e4ba94" stroke="#0e1d31" strokeWidth="1.5" />
        <path d="M146 211C145 194 153 187 166 188C177 188 183 199 182 212" fill="#162a45" />
        <path d="M147 238Q162 228 181 239L187 308H141L147 238Z" fill="#162a45" stroke="#0e1d31" strokeWidth="1.5" />
        <path d="M158 240L163 251L170 240" fill="#fffdf8" />
        <path d="M181 248L219 230L238 231" stroke="#162a45" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="238" cy="231" r="4.4" fill="#e4ba94" />
        <path d="M220 233V283M205 251H241" stroke="#ad4b08" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="215" y="237" width="30" height="42" rx="2" fill="#fffdf8" stroke="#0e1d31" strokeWidth="1.2" />
        <path d="M221 246H239M221 253H236M221 260H234" stroke="#c2b298" strokeWidth="2" strokeLinecap="round" />
        <rect x="225" y="266" width="11" height="9" rx="1" fill="#cf7739" />
        <circle cx="285" cy="207" r="19" fill="#e4ba94" stroke="#0e1d31" strokeWidth="1.4" />
        <path d="M267 205C267 189 277 184 287 185C296 186 304 197 303 207" fill="#5b4a3e" />
        <path d="M267 235Q285 226 303 236L309 310H261L267 235Z" fill="#fffdf8" stroke="#0e1d31" strokeWidth="1.5" />
        <path d="M284 239V303" stroke="#b8ad99" strokeWidth="1.3" />
        <circle cx="375" cy="210" r="18" fill="#cfaa83" stroke="#0e1d31" strokeWidth="1.4" />
        <path d="M358 209C359 191 372 184 386 195L390 208C377 204 370 203 358 209Z" fill="#162a45" />
        <path d="M358 235Q376 227 391 239L398 307H352L358 235Z" fill="#fffdf8" stroke="#0e1d31" strokeWidth="1.5" />
        <path d="M372 241V305" stroke="#b8ad99" strokeWidth="1.3" />
        <text x="282" y="377" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="13" fontWeight="700" letterSpacing="1.2" fill="#ad4b08">02  /  FORMER &amp; ANIMER</text>
      </g>

      {/* 03 · The pharmacist recommends the same orange product to a customer. */}
      <g className="tr1-scene tr1-scene-three">
        <circle cx="177" cy="212" r="19" fill="#e4ba94" stroke="#0e1d31" strokeWidth="1.4" />
        <path d="M158 211C157 193 167 188 178 189C193 191 196 202 194 214L187 207L169 202Z" fill="#5b4a3e" />
        <path d="M159 240Q175 230 192 240L198 307H153L159 240Z" fill="#c2b298" stroke="#0e1d31" strokeWidth="1.5" />
        <path d="M191 247L226 270L247 260" stroke="#c2b298" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="249" cy="260" r="4.5" fill="#e4ba94" />
        <path d="M145 276L129 301L144 314H162L174 303L160 285" fill="#fffdf8" stroke="#0e1d31" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M147 290Q152 280 160 290" stroke="#0e1d31" strokeWidth="1.4" />
        <circle cx="286" cy="207" r="19" fill="#e4ba94" stroke="#0e1d31" strokeWidth="1.4" />
        <path d="M267 208C267 189 278 184 289 185C301 187 304 196 304 208" fill="#5b4a3e" />
        <path d="M269 234Q285 226 303 237L309 309H262L269 234Z" fill="#fffdf8" stroke="#0e1d31" strokeWidth="1.5" />
        <path d="M283 237V306M266 244L283 258L300 244" stroke="#b8ad99" strokeWidth="1.3" />
        <path d="M269 247L253 258" stroke="#fffdf8" strokeWidth="9" strokeLinecap="round" />
        <path d="M269 247L253 258" stroke="#0e1d31" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M258 250L254 259" stroke="#e4ba94" strokeWidth="4" strokeLinecap="round" />
        <path d="M234 222L238 214M248 225L258 223M241 234L247 242" stroke="#ad4b08" strokeWidth="1.7" strokeLinecap="round" />
        <text x="282" y="377" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="13" fontWeight="700" letterSpacing="1.1" fill="#ad4b08">03  /  DÉVELOPPER LES VENTES</text>
      </g>

      {/* A single orange pack persists at exactly the same location across stages. */}
      <g className="tr1-product">
        <rect x="246" y="268" width="24" height="31" rx="2" fill="#cf7739" stroke="#0e1d31" strokeWidth="1.3" />
        <path d="M251 277H265M252 282H263M254 288H261" stroke="#fffdf8" strokeWidth="1.7" strokeLinecap="round" />
      </g>
      {/* The counter is foreground furniture, not a separate scene. */}
      <path d="M234 300H448V337H234Z" fill="#fffdf8" stroke="#0e1d31" strokeWidth="1.7" />
      <path d="M234 300H448M246 312H436" stroke="#b8ad99" strokeWidth="1.2" />
      <path d="M244 337V346M438 337V346" stroke="#0e1d31" strokeWidth="1.7" />
    </svg>
  );
}
