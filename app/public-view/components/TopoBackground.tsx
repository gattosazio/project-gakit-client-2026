import React from 'react';

export function TopoBackground({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute top-0 inset-x-0 h-screen select-none overflow-hidden ${className}`}
    >
      <svg
        className="h-full w-full object-cover"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        {/* Minor intermediate contours (0.9px stroke) */}
        <g stroke="#1a0004" strokeOpacity="0.32" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          {/* Top North-West Ridge */}
          <path d="M-50,60 Q280,120 520,40 T960,110 T1420,50 T1980,80" />
          <path d="M-50,90 Q290,150 540,70 T980,140 T1440,80 T1980,110" />
          <path d="M-50,120 Q300,180 560,100 T1000,170 T1460,110 T1980,140" />
          <path d="M-50,150 Q310,210 580,130 T1020,200 T1480,140 T1980,170" />

          <path d="M-50,210 Q330,270 620,190 T1060,260 T1520,200 T1980,230" />
          <path d="M-50,240 Q340,300 640,220 T1080,290 T1540,230 T1980,260" />
          <path d="M-50,270 Q350,330 660,250 T1100,320 T1560,260 T1980,290" />
          <path d="M-50,300 Q360,360 680,280 T1120,350 T1580,290 T1980,320" />

          {/* Mid River Valley & Meanders */}
          <path d="M-50,360 C240,440 480,280 780,380 S1240,310 1520,410 S1820,320 1980,370" />
          <path d="M-50,390 C250,470 500,310 800,410 S1260,340 1540,440 S1840,350 1980,400" />
          <path d="M-50,420 C260,500 520,340 820,440 S1280,370 1560,470 S1860,380 1980,430" />
          <path d="M-50,450 C270,530 540,370 840,470 S1300,400 1580,500 S1880,410 1980,460" />

          <path d="M-50,510 C290,590 580,430 880,530 S1340,460 1620,560 S1920,470 1980,520" />
          <path d="M-50,540 C300,620 600,460 900,560 S1360,490 1640,590 S1940,500 1980,550" />
          <path d="M-50,570 C310,650 620,490 920,590 S1380,520 1660,620 S1960,530 1980,580" />
          <path d="M-50,600 C320,680 640,520 940,620 S1400,550 1680,650 S1980,560 1980,610" />

          {/* South Basin & Alluvial Fan */}
          <path d="M-50,660 Q360,780 720,670 T1220,730 T1720,640 T1980,680" />
          <path d="M-50,690 Q380,810 740,700 T1240,760 T1740,670 T1980,710" />
          <path d="M-50,720 Q400,840 760,730 T1260,790 T1760,700 T1980,740" />
          <path d="M-50,750 Q420,870 780,760 T1280,820 T1780,730 T1980,770" />

          <path d="M-50,810 Q460,930 820,820 T1320,880 T1820,790 T1980,830" />
          <path d="M-50,840 Q480,960 840,850 T1340,910 T1840,820 T1980,860" />
          <path d="M-50,870 Q500,990 860,880 T1360,940 T1860,850 T1980,890" />
          <path d="M-50,900 Q520,1020 880,910 T1380,970 T1880,880 T1980,920" />

          <path d="M-50,960 Q560,1080 920,970 T1420,1030 T1920,940 T1980,980" />
          <path d="M-50,990 Q580,1110 940,1000 T1440,1060 T1940,970 T1980,1010" />
        </g>

        {/* Major Index Contours (1.6px, bolder, representing 100m elevation intervals) */}
        <g stroke="#120003" strokeOpacity="0.48" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M-50,30 Q270,90 500,10 T940,80 T1400,20 T1980,50" />
          <path d="M-50,180 Q320,240 600,160 T1040,230 T1500,170 T1980,200" />
          <path d="M-50,330 C230,410 460,250 760,350 S1220,280 1500,380 S1800,290 1980,340" />
          <path d="M-50,480 C280,560 560,400 860,500 S1320,430 1600,530 S1900,440 1980,490" />
          <path d="M-50,630 Q340,750 700,640 T1200,700 T1700,610 T1980,650" />
          <path d="M-50,780 Q440,900 800,790 T1300,850 T1800,760 T1980,800" />
          <path d="M-50,930 Q540,1050 900,940 T1400,1000 T1900,910 T1980,950" />
          <path d="M-50,1050 Q620,1170 980,1060 T1480,1120 T1980,1030" />
        </g>

        {/* Concentric Highland Mountain Formations (North-East Summit) */}
        <g stroke="#1a0004" strokeOpacity="0.36" strokeWidth="1.2" strokeLinecap="round">
          <path d="M1420,120 C1540,80 1680,100 1740,180 C1800,260 1720,340 1600,360 C1480,380 1360,300 1340,220 C1320,140 1380,130 1420,120 Z" />
          <path d="M1450,145 C1540,110 1640,130 1690,190 C1740,250 1670,310 1580,325 C1490,340 1400,280 1385,220 C1370,160 1410,150 1450,145 Z" strokeWidth="1.7" stroke="#120003" strokeOpacity="0.52" />
          <path d="M1480,170 C1540,140 1610,155 1645,200 C1680,245 1630,285 1560,295 C1490,305 1430,260 1420,215 C1410,170 1445,160 1480,170 Z" />
          <path d="M1510,195 C1545,170 1585,180 1605,210 C1625,240 1590,265 1545,270 C1500,275 1460,245 1455,215 C1450,185 1480,180 1510,195 Z" strokeDasharray="6 3" />
          <circle cx="1530" cy="225" r="14" strokeWidth="1.6" stroke="#120003" strokeOpacity="0.55" />
        </g>

        {/* Concentric Highland Mountain Formations (South-West Basin / River Gorge) */}
        <g stroke="#1a0004" strokeOpacity="0.36" strokeWidth="1.2" strokeLinecap="round">
          <path d="M220,680 C360,620 520,660 580,770 C640,880 540,990 400,1010 C260,1030 120,930 100,810 C80,700 160,690 220,680 Z" />
          <path d="M250,710 C360,660 480,695 530,785 C580,875 500,955 390,970 C280,985 170,905 155,810 C140,725 200,715 250,710 Z" strokeWidth="1.7" stroke="#120003" strokeOpacity="0.52" />
          <path d="M280,740 C360,700 445,725 485,795 C525,865 460,925 380,935 C300,945 220,885 205,815 C190,750 240,740 280,740 Z" />
          <path d="M310,770 C365,740 415,755 440,805 C465,855 420,895 365,900 C310,905 260,865 250,815 C240,775 280,765 310,770 Z" strokeDasharray="6 3" />
          <circle cx="345" cy="830" r="16" strokeWidth="1.6" stroke="#120003" strokeOpacity="0.55" />
        </g>
      </svg>
    </div>
  );
}
