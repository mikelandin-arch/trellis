import { useEffect, useMemo } from 'react';
import { Animated, StyleSheet, type ViewStyle } from 'react-native';
import { colors, borderRadius as radii } from '../../lib/theme';

type LoadingSkeletonProps = {
  readonly width?: ViewStyle['width'];
  readonly height?: number;
  readonly borderRadius?: number;
  readonly style?: ViewStyle;
};

export function LoadingSkeleton({
  width = '100%',
  height = 20,
  borderRadius = radii.sm,
  style,
}: LoadingSkeletonProps): React.ReactNode {
  const opacity = useMemo(() => new Animated.Value(0.4), []);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.neutral.border,
  },
});
