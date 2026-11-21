import { ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function SafeAreaScrollView({
  backgroundColor,
  style,
  ...props
}: ScrollViewProps & { backgroundColor: string }) {
  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor }]}>
      <ScrollView
        {...props}
        style={[styles.fill, style]}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
