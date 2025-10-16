

import Player from 'lottie-react';
import triCubeLoader from '../../public/Tri-cube loader #3.json';

export function CubePreloader({ style }: { style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', ...style }}>
      <Player
        autoplay
        loop
        animationData={triCubeLoader}
        style={{ width: 160, height: 160 }}
      />
    </div>
  );
}
