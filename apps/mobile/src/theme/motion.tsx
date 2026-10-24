import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { motion } from './index';

/** true si el usuario pidió reducir movimiento (AccessibilityInfo). */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduce(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/** Entrada con fade + leve desplazamiento; `index` escalona listas. */
export function FadeInView({
  children,
  index = 0,
  style,
}: {
  children: ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) {
      v.setValue(1);
      return;
    }
    const anim = Animated.timing(v, {
      toValue: 1,
      duration: motion.slow,
      delay: Math.min(index, 8) * motion.stagger,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [v, index, reduce]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Pressable con feedback de escala/opacidad (150ms). */
export function PressableScale({
  style,
  children,
  disabled,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  const to = (value: number) => {
    if (reduce) return v.setValue(value);
    Animated.timing(v, {
      toValue: value,
      duration: motion.fast,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={() => to(1)}
      onPressOut={() => to(0)}
      {...rest}
    >
      <Animated.View
        style={[
          style,
          {
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] }),
            transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] }) }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
