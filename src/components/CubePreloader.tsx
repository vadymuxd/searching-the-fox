

import Player from 'lottie-react';
import triCubeLoader from '../../public/Tri-cube loader #3.json';

interface CubePreloaderProps {
  style?: React.CSSProperties;
  isLoaded?: boolean;
}

export function CubePreloader({ style, isLoaded = false }: CubePreloaderProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', ...style }}>
      <Player
        autoplay
        loop={!isLoaded}
        animationData={triCubeLoader}
        style={{ width: 160, height: 160 }}
      />
    </div>
  );
}
