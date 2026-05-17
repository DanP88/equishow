import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';

interface AlertModalProps {
  visible: boolean;
  title: string;
  message?: string;
  okLabel?: string;
  variant?: 'info' | 'success' | 'error';
  onClose: () => void;
}

export function AlertModal({
  visible,
  title,
  message,
  okLabel = 'OK',
  variant = 'info',
  onClose,
}: AlertModalProps) {
  const accent =
    variant === 'success' ? Colors.success :
    variant === 'error'   ? Colors.urgent :
                            Colors.primary;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.sheet}>
          <Text style={s.title}>{title}</Text>
          {message ? <Text style={s.message}>{message}</Text> : null}
          <TouchableOpacity style={[s.btn, { backgroundColor: accent }]} onPress={onClose} activeOpacity={0.85}>
            <Text style={s.btnText}>{okLabel}</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xxl,
    width: '100%',
    maxWidth: 400,
    padding: Spacing.xl,
    gap: Spacing.md,
    ...Shadow.modal,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  btnText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
  },
});
