import Svg, { Path } from 'react-native-svg';

export default function LeafIcon({ size = 40, color = '#83C5BE' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C8 6 4 12 12 22C20 12 16 6 12 2Z"
        fill={color}
      />
    </Svg>
  );
}
