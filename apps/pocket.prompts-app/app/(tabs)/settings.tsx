import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { members, type Member } from '@/src/lib/members';
import { get_member_id, set_member_id } from '@/src/lib/storage';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function SettingsScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const colors = Colors[scheme];

  const [selected, set_selected] = useState<string | null>(null);

  useEffect(() => {
    get_member_id().then(set_selected);
  }, []);

  const handle_select = async (member: Member) => {
    set_selected(member.id);
    await set_member_id(member.id);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.section_title, { color: colors.textSecondary }]}>
        member
      </Text>
      <Text style={[styles.section_desc, { color: colors.textSecondary }]}>
        select your name to route voice commands to your accounts
      </Text>

      <View style={styles.member_list}>
        {members.map((m) => {
          const is_selected = selected === m.id;
          return (
            <Pressable
              key={m.id}
              style={[
                styles.member_row,
                {
                  backgroundColor: is_selected ? colors.accent + '15' : colors.surface,
                  borderColor: is_selected ? colors.accent : colors.surfaceBorder,
                },
              ]}
              onPress={() => handle_select(m)}
            >
              <View style={styles.member_info}>
                <Text style={[styles.member_name, { color: colors.text }]}>
                  {m.id}
                </Text>
                <Text style={[styles.member_email, { color: colors.textSecondary }]}>
                  {m.email}
                </Text>
              </View>
              {is_selected && (
                <SymbolView
                  name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                  tintColor={colors.accent}
                  size={22}
                />
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footer_text, { color: colors.textSecondary }]}>
          pocket.prompts v1.0.0
        </Text>
        <Text style={[styles.footer_text, { color: colors.textSecondary }]}>
          winded.vertigo collective
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20 },
  section_title: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  section_desc: {
    fontSize: 13,
    marginBottom: 16,
  },
  member_list: {
    gap: 8,
  },
  member_row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  member_info: {
    flex: 1,
  },
  member_name: {
    fontSize: 16,
    fontWeight: '600',
  },
  member_email: {
    fontSize: 13,
    marginTop: 2,
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
    gap: 4,
  },
  footer_text: {
    fontSize: 12,
  },
});
