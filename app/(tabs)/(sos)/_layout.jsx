import { Stack } from "expo-router";

export default function SOSLayout() {
  return (
    <Stack>
        <Stack.Screen name="sos" options={{ title: "SOS", headerShown: false }} />
    </Stack>
  );
}